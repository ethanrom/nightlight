// Client-side orchestrator: parse locally -> prepare/redact -> batched LLM calls -> Report.
// Raw files never leave the browser; only the prepared, redacted items are sent to the API.
import { parseFile, parseTranscript } from "./parse";
import { prepare } from "./preprocess";
import type {
  ApiResult,
  AuditChatsResult,
  ChatAudit,
  ClassifyHistoryResult,
  DatedChatAudit,
  DomainCategory,
  FlaggedHistoryItem,
  HistoryFlag,
  HistoryItem,
  LlmErrorKind,
  ParsedFile,
  PipelineError,
  PipelineInput,
  PipelineProgress,
  PreparedConversation,
  Report,
  Summary,
  SummarizeRequest,
} from "./types";

const HISTORY_BATCH = 150;
const CHAT_BATCH_MAX_CONVERSATIONS = 4;
const CHAT_BATCH_MAX_CHARS = 40_000;
const CONCURRENCY = 4;

class ApiCallError extends Error {
  constructor(
    public kind: LlmErrorKind,
    message: string,
  ) {
    super(message);
  }
}

async function postJson<T>(url: string, body: unknown, attempts = 2): Promise<T> {
  let lastError: ApiCallError | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as ApiResult<T> | null;
      if (data?.ok) return data.result;
      const kind = data && !data.ok ? data.error.kind : "api";
      lastError = new ApiCallError(kind, data && !data.ok ? data.error.message : `HTTP ${res.status}`);
      // Refusals and bad requests won't change on retry.
      if (kind === "refusal" || kind === "bad_request") break;
    } catch (err) {
      lastError = new ApiCallError("api", err instanceof Error ? err.message : String(err));
    }
  }
  throw lastError ?? new ApiCallError("api", "Request failed");
}

/** Runs `worker` over `items` with at most `limit` in flight. */
async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await worker(items[next++]);
  });
  await Promise.all(runners);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function packConversations(conversations: PreparedConversation[]): PreparedConversation[][] {
  const batches: PreparedConversation[][] = [];
  let current: PreparedConversation[] = [];
  let chars = 0;
  for (const c of conversations) {
    const size = c.messages.reduce((n, m) => n + m.text.length, 0);
    if (current.length && (current.length >= CHAT_BATCH_MAX_CONVERSATIONS || chars + size > CHAT_BATCH_MAX_CHARS)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(c);
    chars += size;
  }
  if (current.length) batches.push(current);
  return batches;
}

function errorKind(err: unknown): LlmErrorKind {
  return err instanceof ApiCallError ? err.kind : "api";
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function runPipeline(
  input: PipelineInput,
  onProgress: (p: PipelineProgress) => void,
  options: { shiftTimestampsMs?: number } = {},
): Promise<Report> {
  const progress: PipelineProgress = {
    stage: "parsing",
    found: { pages: 0, searches: 0, conversations: 0, piiRedacted: 0 },
    history: { done: 0, total: 0 },
    chats: { done: 0, total: 0 },
  };
  const emit = () =>
    onProgress({
      ...progress,
      found: { ...progress.found },
      history: { ...progress.history },
      chats: { ...progress.chats },
    });
  emit();

  // 1. Parse every file locally.
  const parsed: ParsedFile[] = [];
  for (const file of input.files) {
    progress.message = `Reading ${file.name}`;
    emit();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await parseFile(file.name, bytes);
    parsed.push(result);
    if (result.kind === "history") progress.found.pages += result.data.visits.length;
    else progress.found.conversations += result.data.conversations.length;
    emit();
  }
  for (const t of input.transcripts) {
    if (!t.text.trim()) continue;
    const data = parseTranscript(t.text, t.platform, input.childName);
    parsed.push({ kind: "chats", fileName: `${t.platform} transcript`, data });
    progress.found.conversations += data.conversations.length;
  }
  if (!parsed.length) throw new Error("Add at least one file or transcript to analyse.");
  if (options.shiftTimestampsMs) shiftParsed(parsed, options.shiftTimestampsMs);

  // 2. Dedupe, extract searches, redact PII, compute local stats.
  progress.stage = "preparing";
  progress.message = "Redacting personal details";
  emit();
  const prepared = prepare(parsed);
  progress.found = {
    pages: prepared.stats.uniquePages,
    searches: prepared.stats.searchCount,
    conversations: prepared.conversations.length,
    piiRedacted: prepared.pii.length,
  };

  const historyBatches = chunk(prepared.historyItems, HISTORY_BATCH);
  const chatBatches = packConversations(prepared.conversations);
  progress.history.total = historyBatches.length;
  progress.chats.total = chatBatches.length;
  progress.stage = historyBatches.length ? "history" : "chats";
  progress.message = undefined;
  emit();

  // Lets the server show the model local clock times, so "late night" means the child's late night.
  const tzOffsetMinutes = new Date().getTimezoneOffset();
  const errors: PipelineError[] = [];
  const historyFlags: HistoryFlag[] = [];
  const domainCategories = new Map<string, DomainCategory>();
  const chatAudits: ChatAudit[] = [];

  // 3 + 4. History and chat analysis run side by side.
  const historyJob = pool(historyBatches, CONCURRENCY, async (items) => {
    try {
      const result = await postJson<ClassifyHistoryResult>("/api/classify-history", {
        ageBand: input.ageBand,
        items,
      });
      historyFlags.push(...result.flags);
      for (const d of result.domains) domainCategories.set(d.domain, d);
    } catch (err) {
      errors.push({ stage: "history", kind: errorKind(err), message: errorMessage(err), affected: items.length });
    } finally {
      progress.history.done++;
      emit();
    }
  }).then(() => {
    if (progress.stage === "history") {
      progress.stage = "chats";
      emit();
    }
  });

  const chatJob = pool(chatBatches, CONCURRENCY, async (conversations) => {
    try {
      const result = await postJson<AuditChatsResult>("/api/audit-chats", {
        ageBand: input.ageBand,
        conversations,
        tzOffsetMinutes,
      });
      chatAudits.push(...result.audits);
    } catch (err) {
      errors.push({ stage: "chats", kind: errorKind(err), message: errorMessage(err), affected: conversations.length });
    } finally {
      progress.chats.done++;
      emit();
    }
  });

  await Promise.all([historyJob, chatJob]);

  // 5. Cross-source summary, with chat audits in chronological order so trends are visible.
  progress.stage = "summary";
  emit();
  const itemById = new Map<number, HistoryItem>(prepared.historyItems.map((h) => [h.id, h]));
  const convById = new Map(prepared.conversations.map((c) => [c.id, c]));
  const flaggedHistory: FlaggedHistoryItem[] = historyFlags.flatMap((f) => {
    const item = itemById.get(f.id);
    if (!item) return [];
    return [
      {
        ...f,
        domain: item.domain,
        title: item.title,
        search: item.search,
        lastSeen: item.lastSeen,
        visits: item.visits,
        lateNight: item.lateNight,
      },
    ];
  });
  const audits: DatedChatAudit[] = chatAudits
    .flatMap((a) => {
      const conv = convById.get(a.id);
      return conv ? [{ ...a, platform: conv.platform, title: conv.title, startedAt: conv.startedAt }] : [];
    })
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));

  let summary: Summary | null = null;
  if (flaggedHistory.length || audits.length || prepared.historyItems.length) {
    const body: SummarizeRequest & { tzOffsetMinutes: number } = {
      ageBand: input.ageBand,
      childName: input.childName,
      stats: prepared.stats,
      flaggedHistory,
      audits,
      pii: prepared.pii,
      tzOffsetMinutes,
    };
    try {
      summary = await postJson<Summary>("/api/summarize", body);
    } catch (err) {
      errors.push({ stage: "summary", kind: errorKind(err), message: errorMessage(err) });
    }
  }

  progress.stage = "done";
  emit();

  return {
    version: 1,
    generatedAt: Date.now(),
    ageBand: input.ageBand,
    childName: input.childName?.trim() || undefined,
    sources: prepared.sources,
    stats: prepared.stats,
    historyItems: prepared.historyItems,
    historyFlags,
    domainCategories: [...domainCategories.values()],
    conversations: prepared.conversations,
    chatAudits,
    pii: prepared.pii,
    summary,
    errors,
    tzOffsetMinutes,
  };
}

function shiftParsed(files: ParsedFile[], ms: number) {
  for (const f of files) {
    if (f.kind === "history") {
      for (const v of f.data.visits) v.ts += ms;
    } else {
      for (const c of f.data.conversations) {
        if (c.startedAt) c.startedAt += ms;
        for (const m of c.messages) if (m.ts) m.ts += ms;
      }
    }
  }
}

/** Shifts every absolute timestamp in a report (local-time aggregates like perDay/heatmap are unchanged). */
function shiftReport(report: Report, ms: number): Report {
  if (!ms) return report;
  const s = (t: number) => t + ms;
  return {
    ...report,
    stats: {
      ...report.stats,
      range: report.stats.range && { start: s(report.stats.range.start), end: s(report.stats.range.end) },
    },
    historyItems: report.historyItems.map((h) => ({ ...h, firstSeen: s(h.firstSeen), lastSeen: s(h.lastSeen) })),
    conversations: report.conversations.map((c) => ({
      ...c,
      startedAt: c.startedAt && s(c.startedAt),
      messages: c.messages.map((m) => ({ ...m, ts: m.ts && s(m.ts) })),
    })),
  };
}

const DEMO_FILES = [
  { path: "/samples/History", name: "History" },
  { path: "/samples/chatgpt-conversations.json", name: "conversations.json" },
];
const DEMO_TRANSCRIPT = { path: "/samples/characterai-transcript.txt", platform: "Character.AI" };

/** Runs the live pipeline on the bundled sample files; falls back to the cached demo report. */
export async function runDemo(onProgress: (p: PipelineProgress) => void): Promise<Report> {
  try {
    const files = await Promise.all(
      DEMO_FILES.map(async (f) => {
        const res = await fetch(f.path);
        if (!res.ok) throw new Error(`Missing demo file ${f.path}`);
        return new File([await res.blob()], f.name);
      }),
    );
    const transcriptRes = await fetch(DEMO_TRANSCRIPT.path);
    const transcripts = transcriptRes.ok
      ? [{ text: await transcriptRes.text(), platform: DEMO_TRANSCRIPT.platform }]
      : [];
    // Sample timestamps are local wall-clock times encoded as UTC; re-anchor them to the viewer's
    // timezone so Maya's 2am chats show up at 2am wherever the demo is opened.
    const report = await runPipeline(
      { files, transcripts, ageBand: "13-15", childName: "Maya" },
      onProgress,
      { shiftTimestampsMs: new Date().getTimezoneOffset() * 60_000 },
    );
    // A run where every LLM stage failed isn't a useful demo – use the cached one instead.
    if (!report.summary && report.errors.length) throw new Error(report.errors[0].message);
    return { ...report, demo: true };
  } catch (err) {
    console.warn("Live demo failed, loading cached report:", err);
    return loadCachedDemo();
  }
}

/** Instantly loads the cached demo report (public/samples/demo-report.json). */
export async function loadCachedDemo(): Promise<Report> {
  const res = await fetch("/samples/demo-report.json");
  if (!res.ok) throw new Error("Demo report not available");
  const report = (await res.json()) as Report;
  const delta = (new Date().getTimezoneOffset() - (report.tzOffsetMinutes ?? 0)) * 60_000;
  return { ...shiftReport(report, delta), demo: true, tzOffsetMinutes: new Date().getTimezoneOffset() };
}
