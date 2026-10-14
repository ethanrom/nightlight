// Evaluation harness for Nightlight (see docs/evaluation.md).
//
//   npm run eval                          collect everything fresh (about $1-2 of Bedrock), then score it
//   npm run eval -- --resume              reuse raw output already in eval/out/, collect only what is missing
//   npm run eval -- --score-only          re-score the saved raw output (no network at all)
//   npm run eval -- --only-moderation     run only the key/matcher check and the (free) OpenAI moderation stage
//   npm run eval -- --preview             score what exists WITHOUT moderation and print it; writes no results file
//   npm run eval -- --skip-moderation     collect the Bedrock stages without OpenAI moderation (add it later with --resume);
//                                         nothing is written to data/eval-results.json until moderation output exists
//
// Methods compared on the labelled synthetic dataset (eval/answer-key.ts, written before any run):
//   moderation  - OpenAI omni-moderation-latest on every history title/search and every child message
//   single_chat - Nightlight's chat audit on each conversation alone (batch of 1, no summary)
//   nightlight  - the full pipeline (lib/pipeline.ts runDemo), 3 runs
//
// The system under test is NOT modified or tuned here: this script only calls the production route handlers.
process.env.TZ = "UTC"; // the sample files are wall-clock times encoded as UTC; makes the run machine-independent
process.env.IP_DAILY_BUDGET_USD = "50"; // the in-process guard (lib/guard.ts) would otherwise block the evaluation
process.env.DAILY_BUDGET_USD = "50";
process.env.IP_BURST_PER_MIN = "100000";
process.env.CHAT_PER_IP_DAILY = "100000";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  AI_GRADES,
  BENIGN_CONVERSATIONS,
  BENIGN_EXCLUSIONS,
  BENIGN_HISTORY_DOMAINS,
  DATASET_FACTS,
  PATTERNS,
  SIGNALS,
  type ChatMatch,
  type KeyPattern,
  type KeySignal,
  type Match,
} from "../eval/answer-key";
import type {
  EvalAiGrade,
  EvalFalseAlarm,
  EvalPattern,
  EvalResults,
  EvalSignal,
  IsolationResult,
  MethodResult,
  PatternEvidence,
  Score,
  SourceLane,
} from "../lib/eval-types";
import { parseFile, parseTranscript } from "../lib/parse";
import { prepare } from "../lib/preprocess";
import { severityRank, type AiResponseGrade, type DimensionId, type Severity } from "../lib/rubric";
import type {
  ApiResult,
  AuditChatsResult,
  ChatAudit,
  HistoryFlag,
  HistoryItem,
  ParsedFile,
  PipelineProgress,
  PreparedConversation,
  PreparedData,
  Report,
  TopConcern,
  Trend,
} from "../lib/types";

// ---------------------------------------------------------------- setup

const ROOT = process.cwd();
// EVAL_SANDBOX=<dir> redirects every output (raw files, results JSON, doc) away from the repo; used only to test the scorer.
const SANDBOX = process.env.EVAL_SANDBOX;
const OUT_DIR = SANDBOX ? path.join(SANDBOX, "out") : path.join(ROOT, "eval", "out");
const RESULTS_PATH = SANDBOX ? path.join(SANDBOX, "eval-results.json") : path.join(ROOT, "data", "eval-results.json");
const DOC_PATH = SANDBOX ? path.join(SANDBOX, "evaluation.md") : path.join(ROOT, "docs", "evaluation.md");
const KEY_PATH = path.join(ROOT, "eval", "answer-key.ts");
const NIGHTLIGHT_RUNS = 3;
const AGE_BAND = DATASET_FACTS.ageBand;
const MODERATION_MODEL = "omni-moderation-latest";
const TABLES_START = "<!-- eval:tables:start -->";
const TABLES_END = "<!-- eval:tables:end -->";

const args = new Set(process.argv.slice(2));
const SCORE_ONLY = args.has("--score-only");
const RESUME = args.has("--resume");
const ONLY_MODERATION = args.has("--only-moderation");
const SKIP_MODERATION = args.has("--skip-moderation");
const PREVIEW = args.has("--preview");

const realFetch: typeof fetch = globalThis.fetch.bind(globalThis);

/** Strips anything that looks like a key or a cloud resource id from text we print or store. */
function scrub(s: string): string {
  return s
    .replace(/sk-[A-Za-z0-9_\-*]{6,}/g, "sk-***")
    .replace(/arn:aws:[^\s"',)]+/g, "arn:aws:***")
    .replace(/\b\d{12}\b/g, "************")
    .slice(0, 400);
}
const text = (a: unknown) => scrub(a instanceof Error ? a.message : typeof a === "string" ? a : JSON.stringify(a) ?? String(a));

// ---- console tap: collect the routes' "[llm]" usage lines (they carry the estimated cost) and warnings
interface LlmLine {
  call: string;
  model: string;
  in: number;
  out: number;
  usd: number;
}
const llmLines: LlmLine[] = [];
const warnings: string[] = [];
function installConsoleTap() {
  const log = console.log.bind(console);
  const warn = console.warn.bind(console);
  const error = console.error.bind(console);
  console.log = (...a: unknown[]) => {
    if (a[0] === "[llm]") {
      try {
        llmLines.push(JSON.parse(String(a[1])) as LlmLine);
      } catch {
        /* ignore malformed usage line */
      }
      return;
    }
    log(...a);
  };
  console.warn = (...a: unknown[]) => {
    const line = a.map(text).join(" ");
    warnings.push(line);
    warn(line);
  };
  console.error = (...a: unknown[]) => {
    const line = a.map(text).join(" ");
    warnings.push(line);
    error(line);
  };
}
const sumUsd = (from: number) => llmLines.slice(from).reduce((n, l) => n + (Number.isFinite(l.usd) ? l.usd : 0), 0);

// ---------------------------------------------------------------- raw output types

interface Attempt {
  ok: boolean;
  seconds: number;
  costUsd: number;
  failure?: string;
}
interface RunRecord {
  run: number;
  seconds: number;
  costUsd: number;
  attempts: Attempt[];
  llmCalls: number;
  /** pipeline errors left in the accepted run (empty on a clean run) */
  pipelineErrors: string[];
  /** console warnings/errors the routes printed during the accepted attempt (scrubbed), e.g. a retried schema failure */
  warnings?: string[];
  report: Report;
}
interface SingleChatRecord {
  seconds: number;
  costUsd: number;
  audits: Record<string, ChatAudit | null>;
  errors: Record<string, string>;
}
interface ModRecord {
  key: string;
  kind: "history_title" | "history_search" | "child_message" | "ai_message";
  text: string;
  flagged: boolean;
  categories: string[];
  topCategory: string | null;
  topScore: number | null;
}
interface Meta {
  generatedAt: string;
  keySha256: string;
  node: string;
  tz: string;
  models: { fast: string; smart: string; moderation: string };
}

const outFile = (name: string) => path.join(OUT_DIR, name);
const writeJson = (name: string, value: unknown) => fs.writeFileSync(outFile(name), JSON.stringify(value));
const readJson = <T>(name: string): T => JSON.parse(fs.readFileSync(outFile(name), "utf8")) as T;
const exists = (name: string) => fs.existsSync(outFile(name));

// ---------------------------------------------------------------- matching helpers

const SEVS: Severity[] = ["normal", "worth_noticing", "talk_soon", "urgent"];
const rk = (s: Severity | null | undefined) => (s ? severityRank(s) : 0);
const sevOfRank = (r: number): Severity => SEVS[Math.max(0, Math.min(3, r))];
/** Lower median (for 3 runs this is the middle one). */
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function historyMatches(item: HistoryItem, m: Match): boolean {
  if (m.kind !== "history") return false;
  if (m.domain && !m.domain.test(item.domain)) return false;
  if (m.path && !m.path.test(item.path)) return false;
  if (m.title && !m.title.test(item.title)) return false;
  if (m.search && !(item.search && m.search.test(item.search))) return false;
  return true;
}
function chatMatches(conv: { id: string; platform: string }, m: Match): boolean {
  if (m.kind !== "chat") return false;
  if (m.id && conv.id !== m.id) return false;
  if (m.platform && conv.platform !== m.platform) return false;
  return true;
}
const itemsFor = (sig: { match: Match[] }, items: HistoryItem[]) => items.filter((i) => sig.match.some((m) => historyMatches(i, m)));
const convsFor = <C extends { id: string; platform: string }>(sig: { match: Match[] }, convs: C[]) =>
  convs.filter((c) => sig.match.some((m) => chatMatches(c, m)));
const itemKey = (i: HistoryItem) => `${i.domain}|${i.path}|${i.title}|${i.search ?? ""}`;
const itemLabel = (i: HistoryItem) => (i.search ? `Search: “${i.search}” (${i.domain})` : `Page: “${i.title}” (${i.domain})`);
const isBenignItem = (i: HistoryItem) =>
  BENIGN_HISTORY_DOMAINS.some((r) => r.test(i.domain)) && !SIGNALS.some((s) => s.match.some((m) => historyMatches(i, m)));

type ParsedRef = { kind: "h"; id: number } | { kind: "c"; conv: string; idx: number };
function parseRef(raw: string): ParsedRef | null {
  const r = raw.trim().replace(/^\[|\]$/g, "");
  let m = /^h:(\d+)$/.exec(r);
  if (m) return { kind: "h", id: Number(m[1]) };
  m = /^c:(.+):(\d+)$/.exec(r);
  if (m) return { kind: "c", conv: m[1], idx: Number(m[2]) };
  return null;
}

// ---------------------------------------------------------------- the dataset (built like the pipeline does)

async function loadPrepared(): Promise<PreparedData> {
  const sample = (f: string) => path.join(ROOT, "public", "samples", f);
  const parsed: ParsedFile[] = [];
  parsed.push(await parseFile("History", new Uint8Array(fs.readFileSync(sample("History")))));
  parsed.push(await parseFile("conversations.json", new Uint8Array(fs.readFileSync(sample("chatgpt-conversations.json")))));
  const transcript = parseTranscript(fs.readFileSync(sample("characterai-transcript.txt"), "utf8"), "Character.AI", DATASET_FACTS.child);
  parsed.push({ kind: "chats", fileName: "Character.AI transcript", data: transcript });
  return prepare(parsed);
}

/** Pre-run sanity check of the key against the dataset (no model involved). Throws if a matcher selects nothing. */
function checkKeyMatchers(prepared: PreparedData) {
  const problems: string[] = [];
  for (const s of SIGNALS) {
    const nItems = itemsFor(s, prepared.historyItems).length;
    const nConvs = convsFor(s, prepared.conversations).length;
    if (nItems + nConvs === 0) problems.push(`signal ${s.id} matches nothing`);
    if (s.id.startsWith("c-") && nConvs !== 1) problems.push(`signal ${s.id} should match exactly 1 conversation, matches ${nConvs}`);
  }
  for (const b of BENIGN_CONVERSATIONS) if (!prepared.conversations.some((c) => c.id === b.id)) problems.push(`benign chat ${b.title} missing`);
  for (const g of AI_GRADES) if (convsFor({ match: [g.match] }, prepared.conversations).length !== 1) problems.push(`AI grade key ${g.convTitle} does not match one chat`);
  if (problems.length) throw new Error(`Answer-key matcher problems (key not changed by the script):\n  ${problems.join("\n  ")}`);
}

// ---------------------------------------------------------------- stage 1: OpenAI moderation

function categoriesOf(r: { categories: Record<string, boolean>; category_scores: Record<string, number> }) {
  const on = Object.entries(r.categories).filter(([, v]) => v).map(([k]) => k);
  const pool = on.length ? on : Object.keys(r.category_scores);
  let top: string | null = null;
  let topScore: number | null = null;
  for (const k of pool) {
    const s = r.category_scores[k];
    if (typeof s === "number" && (topScore === null || s > topScore)) {
      top = k;
      topScore = s;
    }
  }
  return { on, top, topScore };
}

async function moderateBatch(batch: string[], key: string): Promise<{ flagged: boolean; categories: Record<string, boolean>; category_scores: Record<string, number> }[]> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    let res: Response;
    try {
      res = await realFetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODERATION_MODEL, input: batch }),
      });
    } catch (err) {
      if (attempt === 4) throw new Error(`OpenAI moderation request failed: ${text(err)}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    if (res.ok) {
      const data = (await res.json()) as { results?: { flagged: boolean; categories: Record<string, boolean>; category_scores: Record<string, number> }[] };
      if (!data.results || data.results.length !== batch.length) throw new Error("OpenAI moderation returned an unexpected number of results");
      return data.results;
    }
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    const message = scrub(body?.error?.message ?? res.statusText);
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    throw new Error(`OpenAI moderation HTTP ${res.status}: ${message}`);
  }
  throw new Error("OpenAI moderation failed");
}

async function runModeration(prepared: PreparedData): Promise<ModRecord[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const inputs: { key: string; kind: ModRecord["kind"]; text: string }[] = [];
  for (const h of prepared.historyItems) {
    if (h.title.trim()) inputs.push({ key: `h:${h.id}:title`, kind: "history_title", text: h.title });
    if (h.search?.trim()) inputs.push({ key: `h:${h.id}:search`, kind: "history_search", text: h.search });
  }
  for (const c of prepared.conversations) {
    for (const m of c.messages) {
      if (m.text.trim()) inputs.push({ key: `c:${c.id}:${m.i}`, kind: m.role === "child" ? "child_message" : "ai_message", text: m.text });
    }
  }
  const records: ModRecord[] = [];
  for (let i = 0; i < inputs.length; i += 50) {
    const batch = inputs.slice(i, i + 50);
    const results = await moderateBatch(batch.map((b) => b.text), key);
    batch.forEach((b, j) => {
      const c = categoriesOf(results[j]);
      records.push({ ...b, flagged: results[j].flagged, categories: c.on, topCategory: c.top, topScore: c.topScore });
    });
    process.stdout.write(`\r[moderation] ${Math.min(i + 50, inputs.length)}/${inputs.length}`);
  }
  process.stdout.write("\n");
  return records;
}

// ---------------------------------------------------------------- stage 2: Nightlight runs (full pipeline)

type Routes = Record<string, (req: Request) => Promise<Response>>;
function installFetchShim(routes: Routes) {
  // Relative API paths go to the route handlers, /samples/* is served from public/, absolute URLs hit the real fetch.
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if (typeof input !== "string" || !input.startsWith("/")) return realFetch(input, init);
    const route = routes[input];
    if (route) return route(new Request(`http://localhost${input}`, init));
    if (input.startsWith("/samples/")) {
      const file = path.join(ROOT, "public", input);
      if (!fs.existsSync(file)) return new Response("not found", { status: 404 });
      return new Response(fs.readFileSync(file));
    }
    throw new Error(`Unexpected fetch ${input}`);
  }) as typeof fetch;
}

type RunDemo = (onProgress: (p: PipelineProgress) => void) => Promise<Report>;

async function collectNightlightRun(run: number, runDemo: RunDemo): Promise<RunRecord> {
  const attempts: Attempt[] = [];
  let calls = 0;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const mark = llmLines.length;
    const warnMark = warnings.length;
    const t0 = Date.now();
    let last = "";
    const report = await runDemo((p) => {
      const line = `${p.stage} history ${p.history.done}/${p.history.total} chats ${p.chats.done}/${p.chats.total}`;
      if (line !== last) console.log(`  [run ${run}.${attempt} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${line}`);
      last = line;
    });
    const seconds = (Date.now() - t0) / 1000;
    const costUsd = sumUsd(mark);
    calls = llmLines.length - mark;
    const pipelineErrors = report.errors.map((e) => `${e.stage}/${e.kind}: ${scrub(e.message)} (affected ${e.affected ?? "?"})`);
    let failure: string | undefined;
    if (report.cachedFallback) {
      const why = warnings.slice(warnMark).find((w) => w.startsWith("Live demo failed")) ?? "reason not captured";
      failure = `fell back to the cached report (${why})`;
    } else if (!report.summary) failure = "no summary was produced";
    else if (pipelineErrors.length) failure = `pipeline errors: ${pipelineErrors.join("; ")}`;
    attempts.push({ ok: !failure, seconds, costUsd, ...(failure ? { failure } : {}) });
    const usable = !report.cachedFallback && !!report.summary;
    if (!failure || (attempt === 2 && usable)) {
      return { run, seconds, costUsd, attempts, llmCalls: calls, pipelineErrors, warnings: warnings.slice(warnMark), report };
    }
    console.log(`  run ${run}.${attempt} failed: ${failure}${attempt === 1 ? "; retrying once" : ""}`);
  }
  throw new Error(`Nightlight run ${run} failed twice; refusing to score a cached or empty report. Attempts: ${JSON.stringify(attempts)}`);
}

// ---------------------------------------------------------------- stage 3: single-chat view

async function collectSingleChat(prepared: PreparedData, audit: (req: Request) => Promise<Response>): Promise<SingleChatRecord> {
  const mark = llmLines.length;
  const t0 = Date.now();
  const audits: Record<string, ChatAudit | null> = {};
  const errors: Record<string, string> = {};
  const queue = [...prepared.conversations];
  const tz = new Date().getTimezoneOffset();
  const worker = async () => {
    for (let conv = queue.shift(); conv; conv = queue.shift()) {
      audits[conv.id] = null;
      for (let attempt = 1; attempt <= 2 && !audits[conv.id]; attempt++) {
        try {
          const res = await audit(
            new Request("http://localhost/api/audit-chats", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ageBand: AGE_BAND, conversations: [conv], tzOffsetMinutes: tz }),
            }),
          );
          const data = (await res.json()) as ApiResult<AuditChatsResult>;
          if (data.ok && data.result.audits[0]) audits[conv.id] = data.result.audits[0];
          else errors[conv.id] = data.ok ? "no audit returned" : scrub(`${data.error.kind}: ${data.error.message}`);
        } catch (err) {
          errors[conv.id] = text(err);
        }
      }
      if (audits[conv.id]) delete errors[conv.id];
      console.log(`  [single-chat] ${Object.keys(audits).length}/${prepared.conversations.length} ${audits[conv.id] ? "ok" : "FAILED"}`);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return { seconds: (Date.now() - t0) / 1000, costUsd: sumUsd(mark), audits, errors };
}

// ---------------------------------------------------------------- scoring: per-signal evaluation of one "view"

interface FlagLite {
  dimension: DimensionId;
  severity: Severity;
}
/** What one method produced for the dataset, in a shape the scorer can query. */
interface View {
  items: HistoryItem[];
  convs: PreparedConversation[];
  historyFlags: HistoryFlag[];
  audits: Map<string, ChatAudit>;
  concerns: TopConcern[];
}
interface SigEval {
  /** detection signals: an accepted-dimension flag at >= worth_noticing. normal controls: raised above normal */
  detected: boolean;
  severity: Severity | null;
  dimension: DimensionId | null;
  /** highest flag on the matched item(s) in any other dimension (when not detected) */
  offDimension: FlagLite | null;
  cited: boolean;
  /** highest severity of any top concern whose evidence cites this item (report level; informational only) */
  citedSeverity: Severity | null;
  matched: number;
  audited: boolean;
}

function evalSignal(sig: KeySignal, view: View): SigEval {
  const items = itemsFor(sig, view.items);
  const convs = convsFor(sig, view.convs);
  const itemIds = new Set(items.map((i) => i.id));
  const convIds = new Set(convs.map((c) => c.id));
  const flags: FlagLite[] = [
    ...view.historyFlags.filter((f) => itemIds.has(f.id)),
    ...convs.flatMap((c) => view.audits.get(c.id)?.flags ?? []),
  ];
  const citing = view.concerns.filter((c) =>
    c.evidence_refs.some((raw) => {
      const r = parseRef(raw);
      return !!r && (r.kind === "h" ? itemIds.has(r.id) : convIds.has(r.conv));
    }),
  );
  const cited = citing.length > 0;
  const citedSeverity = citing.reduce<Severity | null>((b, c) => (rk(c.severity) > rk(b) ? c.severity : b), null);
  const audited = items.length > 0 || convs.every((c) => view.audits.has(c.id));
  const matched = items.length + convs.length;
  const best = (fs: FlagLite[]) => fs.reduce<FlagLite | null>((b, f) => (!b || rk(f.severity) > rk(b.severity) ? f : b), null);

  if (sig.expected === "normal") {
    const top = best(flags);
    const raised = flags.some((f) => rk(f.severity) >= 1) || cited;
    return { detected: raised, severity: top ? top.severity : null, dimension: top ? top.dimension : null, offDimension: null, cited, citedSeverity, matched, audited };
  }
  const accepted = [sig.dimension, ...sig.acceptable];
  const hit = best(flags.filter((f) => accepted.includes(f.dimension) && rk(f.severity) >= 1));
  const off = best(flags.filter((f) => !accepted.includes(f.dimension) && rk(f.severity) >= 1));
  return { detected: !!hit, severity: hit ? hit.severity : null, dimension: hit ? hit.dimension : null, offDimension: off, cited, citedSeverity, matched, audited };
}

const viewOfReport = (r: Report): View => ({
  items: r.historyItems,
  convs: r.conversations,
  historyFlags: r.historyFlags,
  audits: new Map(r.chatAudits.map((a) => [a.id, a])),
  concerns: r.summary?.top_concerns ?? [],
});
const viewOfSingle = (run1: Report, prepared: PreparedData, single: SingleChatRecord): View => ({
  items: run1.historyItems, // history flags are per item and identical in both views: reuse Nightlight run 1
  convs: prepared.conversations,
  historyFlags: run1.historyFlags,
  audits: new Map(Object.entries(single.audits).flatMap(([id, a]) => (a ? [[id, a] as const] : []))),
  concerns: [], // no cross-conversation step
});

// ---------------------------------------------------------------- scoring: moderation

interface ModOutcome {
  detected: boolean;
  flaggedCount: number;
  total: number;
  topCategory: string | null;
}
function moderationFor(sig: KeySignal, prepared: PreparedData, mod: Map<string, ModRecord>): ModOutcome {
  const items = itemsFor(sig, prepared.historyItems);
  const convs = convsFor(sig, prepared.conversations);
  let flaggedCount = 0;
  let total = 0;
  let top: ModRecord | null = null;
  const consider = (recs: (ModRecord | undefined)[]) => {
    const ok = recs.filter((r): r is ModRecord => !!r);
    if (!ok.length) return false;
    const hit = ok.filter((r) => r.flagged);
    for (const r of hit) if (!top || (r.topScore ?? 0) > (top.topScore ?? 0)) top = r;
    return hit.length > 0;
  };
  for (const i of items) {
    total++;
    if (consider([mod.get(`h:${i.id}:title`), mod.get(`h:${i.id}:search`)])) flaggedCount++;
  }
  for (const c of convs) {
    for (const m of c.messages) {
      if (m.role !== "child") continue;
      total++;
      if (consider([mod.get(`c:${c.id}:${m.i}`)])) flaggedCount++;
    }
  }
  const topRec = top as ModRecord | null;
  return { detected: flaggedCount > 0, flaggedCount, total, topCategory: topRec ? topRec.topCategory : null };
}

// ---------------------------------------------------------------- scoring: patterns

type SigMatches = Map<string, { h: Set<number>; c: Set<string> }>;
const sigMatchesFor = (items: HistoryItem[], convs: { id: string; platform: string }[]): SigMatches =>
  new Map(
    SIGNALS.map((s) => [
      s.id,
      { h: new Set(itemsFor(s, items).map((i) => i.id)), c: new Set(convsFor(s, convs).map((c) => c.id)) },
    ]),
  );

interface CiteCtx {
  cited: Set<string>;
  hasH: boolean;
  hasC: boolean;
  lanes: Set<SourceLane>;
}
function citeCtx(report: Report, refs: string[], matches: SigMatches): CiteCtx {
  const ctx: CiteCtx = { cited: new Set(), hasH: false, hasC: false, lanes: new Set() };
  for (const raw of refs) {
    const r = parseRef(raw);
    if (!r) continue;
    if (r.kind === "h") {
      ctx.hasH = true;
      ctx.lanes.add("browsing");
      for (const [sid, m] of matches) if (m.h.has(r.id)) ctx.cited.add(sid);
    } else {
      const conv = report.conversations.find((c) => c.id === r.conv);
      if (!conv) continue;
      ctx.hasC = true;
      ctx.lanes.add(conv.platform === "Character.AI" ? "characterai" : "chatgpt");
      for (const [sid, m] of matches) if (m.c.has(r.conv)) ctx.cited.add(sid);
    }
  }
  return ctx;
}

function checkConcern(rule: NonNullable<KeyPattern["detect"]["concern"]>, c: TopConcern, ctx: CiteCtx): { ok: boolean; reason: string } {
  const min = rule.minSeverity ?? "worth_noticing";
  if (rk(c.severity) < rk(min)) return { ok: false, reason: `${c.severity} is below ${min}` };
  const k = rule.cites;
  if (k.kind === "among") {
    const got = k.signals.filter((s) => ctx.cited.has(s));
    return got.length >= k.atLeast ? { ok: true, reason: "" } : { ok: false, reason: `cited ${got.length} of the ${k.atLeast} required (${got.join(", ") || "none"})` };
  }
  if (k.kind === "all") {
    const missing = k.signals.filter((s) => !ctx.cited.has(s));
    return missing.length === 0 ? { ok: true, reason: "" } : { ok: false, reason: `did not cite ${missing.join(" or ")}` };
  }
  if (k.kind === "lanes") {
    return ctx.lanes.size >= k.atLeast ? { ok: true, reason: "" } : { ok: false, reason: `cited ${ctx.lanes.size} source(s), needs ${k.atLeast}` };
  }
  return ctx.hasH && ctx.hasC ? { ok: true, reason: "" } : { ok: false, reason: `cited ${ctx.hasH ? "only browsing" : ctx.hasC ? "only chat" : "no"} evidence` };
}

interface PatternRun {
  detected: boolean;
  via: ("trend" | "concern")[];
  severity: Severity | null;
  direction: Trend["direction"] | null;
  miss: string;
}
function evalPatternRun(p: KeyPattern, report: Report): PatternRun {
  const summary = report.summary;
  if (!summary) return { detected: false, via: [], severity: null, direction: null, miss: "no summary" };
  const rule = p.detect;
  const matches = sigMatchesFor(report.historyItems, report.conversations);
  const via: PatternRun["via"] = [];
  const miss: string[] = [];

  const trendDims = rule.trend?.dimensions ?? [p.dimension];
  const anyTrend = summary.trends.find((t) => trendDims.includes(t.dimension));
  if (rule.trend) {
    const ok = summary.trends.some((t) => rule.trend!.dimensions.includes(t.dimension) && rule.trend!.directions.includes(t.direction));
    if (ok) via.push("trend");
    else miss.push(anyTrend ? `${anyTrend.dimension} trend was ${anyTrend.direction}` : `no ${rule.trend.dimensions.join("/")} trend`);
  }

  let severity: Severity | null = null;
  if (rule.concern) {
    const rc = rule.concern;
    const ofDim = summary.top_concerns.filter((c) => rc.dimensions.includes(c.dimension));
    if (!ofDim.length) miss.push(`no ${rc.dimensions.join("/")} concern`);
    let qualifying = 0;
    for (const c of ofDim) {
      const res = checkConcern(rc, c, citeCtx(report, c.evidence_refs, matches));
      if (res.ok) {
        qualifying++;
        if (rk(c.severity) > rk(severity)) severity = c.severity;
      } else miss.push(`${c.dimension} concern (${c.severity}) ${res.reason}`);
    }
    if (qualifying) via.push("concern");
    if (!severity) for (const c of ofDim) if (rk(c.severity) > rk(severity)) severity = c.severity;
  }
  return { detected: via.length > 0, via, severity, direction: anyTrend?.direction ?? null, miss: via.length ? "" : miss.join("; ") };
}

// ---------------------------------------------------------------- scoring: assemble results

interface Collected {
  meta: Meta;
  moderation: ModRecord[];
  runs: RunRecord[];
  single: SingleChatRecord;
}
interface Extras {
  keySha256: string;
  keyUnchanged: boolean;
  runs: { run: number; seconds: number; costUsd: number; llmCalls: number; attempts: Attempt[]; pipelineErrors: string[] }[];
  single: { seconds: number; costUsd: number; failed: string[]; grades: { title: string; platform: string; grade: AiResponseGrade | null }[] };
  totalBedrockUsd: number;
  wastedUsd: number;
  consistencyCount: [number, number];
  severityConsistencyCount: [number, number];
  falseAlarmsPerRun: { talkSoonOrUrgent: number; worthNoticing: number }[];
  benignItems: number;
  benignConversations: number;
  moderationAi: { flagged: number; total: number; top: string[] };
  moderationInputs: { historyInputs: number; childMessages: number; aiMessages: number };
  offDimension: string[];
  verdictFlips: string[];
}

function score(prepared: PreparedData, c: Collected, keyUnchanged: boolean, keySha256: string): { results: EvalResults; extras: Extras } {
  const modMap = new Map(c.moderation.map((r) => [r.key, r]));
  const n = c.runs.length;
  const run1 = c.runs[0].report;
  const nlViews = c.runs.map((r) => viewOfReport(r.report));
  const singleView = viewOfSingle(run1, prepared, c.single);

  // ---- signals
  interface Outcome {
    sig: KeySignal;
    mod: ModOutcome;
    single: SigEval;
    nl: SigEval[];
    nlRank: number;
    nlDetected: boolean;
    nlSeverity: Severity | null;
    nlDimension: DimensionId | null;
  }
  const outcomes: Outcome[] = SIGNALS.map((sig) => {
    const nl = nlViews.map((v) => evalSignal(sig, v));
    const normal = sig.expected === "normal";
    const ranks = nl.map((e) => (normal ? (e.detected ? Math.max(1, rk(e.severity)) : 0) : e.detected ? rk(e.severity) : 0));
    const nlRank = median(ranks);
    const dims = nl.filter((e) => e.detected && e.dimension).map((e) => e.dimension as DimensionId);
    const modal = [...new Set(dims)].sort((a, b) => dims.filter((d) => d === b).length - dims.filter((d) => d === a).length)[0] ?? null;
    return {
      sig,
      mod: moderationFor(sig, prepared, modMap),
      single: evalSignal(sig, singleView),
      nl,
      nlRank,
      nlDetected: nlRank >= 1,
      nlSeverity: nlRank >= 1 ? sevOfRank(nlRank) : normal && nl.some((e) => e.severity === "normal") ? "normal" : null,
      nlDimension: modal,
    };
  });
  const scored = outcomes.filter((o) => o.sig.expected !== "normal");
  const normals = outcomes.filter((o) => o.sig.expected === "normal");
  const expRank = (o: Outcome) => rk(o.sig.expected === "normal" ? "normal" : o.sig.expected);

  const offDimension: string[] = [];
  const signals: EvalSignal[] = outcomes.map((o) => {
    const { sig } = o;
    const normal = sig.expected === "normal";
    const modResult: MethodResult = {
      detected: o.mod.detected,
      note: o.mod.detected
        ? `flagged: ${o.mod.topCategory ?? "unknown category"} (${o.mod.flaggedCount} of ${o.mod.total} ${sig.source === "chat" ? "child messages" : "items"})${normal ? ", a false alarm" : ""}`
        : normal
          ? "not flagged (correct)"
          : "not flagged",
    };
    const singleResult: MethodResult = {
      detected: o.single.detected,
      severity: o.single.severity,
      dimension: o.single.dimension,
      note: noteFor(sig, o.single, "single_chat"),
    };
    const nlRuns = o.nl.map((e) => ({ detected: e.detected, severity: e.severity }));
    const nlResult: MethodResult = {
      detected: o.nlDetected,
      severity: o.nlSeverity,
      dimension: o.nlDimension,
      note: noteFor(sig, o.nl, "nightlight"),
      runs: nlRuns,
    };
    for (const [m, e] of [["single_chat", o.single], ...o.nl.map((x, i) => [`nightlight run ${i + 1}`, x] as const)] as const) {
      if (!normal && !e.detected && e.offDimension) offDimension.push(`${sig.id} [${m}]: flagged ${e.offDimension.dimension} at ${e.offDimension.severity} instead`);
    }
    return {
      id: sig.id,
      label: sig.label,
      source: sig.source,
      lane: sig.lane,
      sourceDetail: sig.sourceDetail,
      date: sig.date,
      dimension: sig.dimension,
      acceptable: sig.acceptable,
      expected: sig.expected,
      whyHard: sig.whyHard,
      results: { moderation: modResult, single_chat: singleResult, nightlight: nlResult },
    };
  });

  // ---- patterns
  const sigById = new Map(SIGNALS.map((s) => [s.id, s]));
  const nlPatternRuns = PATTERNS.map((p) => c.runs.map((r) => evalPatternRun(p, r.report)));
  const patterns: EvalPattern[] = PATTERNS.map((p, pi) => {
    const runs = nlPatternRuns[pi];
    const evidenceSigs = p.evidence.map((id) => sigById.get(id)!).sort((a, b) => a.date.localeCompare(b.date));
    const evidence: PatternEvidence[] = evidenceSigs.map((s) => {
      const items = itemsFor(s, prepared.historyItems).sort((a, b) => b.visits - a.visits);
      const conv = convsFor(s, prepared.conversations)[0];
      const label = conv ? conv.title : items[0] ? (items[0].search ? `Search: ${items[0].search}` : items[0].title) : s.label;
      return { signalId: s.id, date: s.date, lane: s.lane, label };
    });
    const dates = evidenceSigs.map((s) => s.date.slice(0, 10));
    const ruleDims = new Set<DimensionId>([p.dimension, ...(p.detect.concern?.dimensions ?? []), ...(p.detect.trend?.dimensions ?? [])]);

    // isolation: each contributing conversation audited on its own
    const isolation: IsolationResult[] = [];
    const aloneHigh: string[] = [];
    for (const s of evidenceSigs) {
      const conv = convsFor(s, prepared.conversations)[0];
      if (!conv) continue;
      const a = singleView.audits.get(conv.id);
      const top = a ? a.flags.reduce<Severity | null>((b, f) => (rk(f.severity) > rk(b) || b === null ? f.severity : b), null) : null;
      isolation.push({
        convTitle: conv.title,
        platform: conv.platform,
        startedAt: conv.startedAt ? new Date(conv.startedAt).toISOString().slice(0, 19) : s.date,
        isolatedSeverity: top ?? "none",
        mood: a ? a.child_mood : null,
      });
      const inDim = a?.flags.filter((f) => ruleDims.has(f.dimension) && rk(f.severity) >= 2).sort((x, y) => rk(y.severity) - rk(x.severity))[0];
      if (inDim) aloneHigh.push(`“${conv.title}” alone reached ${inDim.severity} (${inDim.dimension})`);
    }
    const isoText = isolation.map((i) => `${i.convTitle}: ${i.isolatedSeverity}${i.mood != null ? `, mood ${i.mood}` : ""}`).join("; ");

    // moderation: per-message, counts only
    const evConvs = evidenceSigs.flatMap((s) => convsFor(s, prepared.conversations));
    const evItems = evidenceSigs.flatMap((s) => itemsFor(s, prepared.historyItems));
    const childMsgs = evConvs.flatMap((cv) => cv.messages.filter((m) => m.role === "child").map((m) => modMap.get(`c:${cv.id}:${m.i}`)));
    const flaggedChild = childMsgs.filter((r) => r?.flagged);
    const histRecs = evItems.flatMap((i) => [modMap.get(`h:${i.id}:title`), modMap.get(`h:${i.id}:search`)]).filter((r): r is ModRecord => !!r);
    const flaggedHist = histRecs.filter((r) => r.flagged);
    const modCats = [...new Set([...flaggedChild, ...flaggedHist].map((r) => r?.topCategory).filter((x): x is string => !!x))];
    const modParts: string[] = [];
    if (evConvs.length) modParts.push(`${flaggedChild.length} of ${childMsgs.length} child messages in the ${evConvs.length} related chat(s)`);
    if (evItems.length) modParts.push(`${flaggedHist.length} of ${histRecs.length} related search/page inputs`);
    const modNote = `Judges one message at a time and never links them: ${modParts.join(" and ")} flagged${modCats.length ? ` (${modCats.join(", ")})` : ""}.`;

    const k = runs.filter((r) => r.detected).length;
    const viaTrend = runs.filter((r) => r.via.includes("trend")).length;
    const viaConcern = runs.filter((r) => r.via.includes("concern")).length;
    const misses = runs.flatMap((r, i) => (r.detected ? [] : [`run ${i + 1}: ${r.miss}`]));
    const nlNote =
      `Detected in ${k} of ${n} runs` +
      (k ? ` (via trend in ${viaTrend}, via concern in ${viaConcern}).` : ".") +
      (misses.length ? ` Not detected: ${misses.join("; ")}.` : "");
    const sevs = runs.map((r) => rk(r.severity)).filter((r) => r > 0);
    const dirs = runs.map((r) => r.direction).filter((d): d is NonNullable<typeof d> => !!d);
    const modalDir = [...new Set(dirs)].sort((a, b) => dirs.filter((d) => d === b).length - dirs.filter((d) => d === a).length)[0] ?? null;

    return {
      id: p.id,
      title: p.title,
      description: p.description,
      dimension: p.dimension,
      span: { from: dates[0], to: dates[dates.length - 1] },
      evidence,
      rule: p.rule,
      results: {
        moderation: { detected: false, note: modNote },
        single_chat: {
          detected: false,
          note: `No cross-conversation step, so it cannot show a trend or link sources. Each chat audited alone: ${isoText}.${aloneHigh.length ? ` ${aloneHigh.join("; ")}.` : ""}`,
        },
        nightlight: { detected: k * 2 > n, note: nlNote },
      },
      isolation,
      nightlight: {
        severity: sevs.length ? sevOfRank(median(sevs)) : null,
        direction: modalDir,
        runsDetected: k,
        runs: n,
      },
    };
  });

  // ---- benign controls and false alarms
  const benignItems = prepared.historyItems.filter(isBenignItem);
  const benignConvs = BENIGN_CONVERSATIONS.map((b) => prepared.conversations.find((cv) => cv.id === b.id)!);
  const outOf = benignItems.length + benignConvs.length;

  /** per-view severity rank of one benign item (history by key, chat by id) */
  const histRank = (view: View, key: string): { rank: number; reason: string } => {
    const ids = new Set(view.items.filter((i) => itemKey(i) === key).map((i) => i.id));
    const fl = view.historyFlags.filter((f) => ids.has(f.id));
    const top = fl.reduce<HistoryFlag | null>((b, f) => (!b || rk(f.severity) > rk(b.severity) ? f : b), null);
    return { rank: top ? rk(top.severity) : 0, reason: top ? `${top.dimension}: ${top.reason}` : "" };
  };
  const chatRank = (view: View, id: string): { rank: number; reason: string } => {
    const a = view.audits.get(id);
    const top = a?.flags.reduce<ChatAudit["flags"][number] | null>((b, f) => (!b || rk(f.severity) > rk(b.severity) ? f : b), null) ?? null;
    return { rank: top ? rk(top.severity) : 0, reason: top ? `${top.dimension}: ${top.explanation}` : "" };
  };
  const benignRows = [
    ...benignItems.map((i) => ({ label: itemLabel(i), rankOf: (v: View) => histRank(v, itemKey(i)) })),
    ...benignConvs.map((cv) => ({ label: `Chat: “${cv.title}” (${cv.platform})`, rankOf: (v: View) => chatRank(v, cv.id) })),
  ];

  const falseAlarms: EvalFalseAlarm[] = [];
  const perRunFa = nlViews.map((v) => {
    const ranks = benignRows.map((r) => r.rankOf(v).rank);
    return { talkSoonOrUrgent: ranks.filter((r) => r >= 2).length, worthNoticing: ranks.filter((r) => r === 1).length };
  });
  let nlFaTalk = 0;
  let nlFaWorth = 0;
  for (const row of benignRows) {
    const per = nlViews.map((v) => row.rankOf(v));
    const rks = per.map((p) => p.rank);
    if (rks.every((r) => r === 0)) continue;
    const talk = rks.filter((r) => r >= 2).length;
    const any = rks.filter((r) => r >= 1).length;
    const counted = talk * 2 > n ? "talk" : any * 2 > n ? "worth" : "none";
    if (counted === "talk") nlFaTalk++;
    else if (counted === "worth") nlFaWorth++;
    const worst = per.reduce((b, p) => (p.rank > b.rank ? p : b), per[0]);
    falseAlarms.push({
      method: "nightlight",
      item: row.label,
      severity: sevOfRank(Math.max(...rks)),
      note: `flagged in ${any} of ${n} runs (${rks.map((r) => sevOfRank(r)).join(", ")}); ${counted === "none" ? "not in the headline count (minority of runs)" : "counted in the headline"}. ${worst.reason}`.trim(),
    });
  }
  let sFaTalk = 0;
  let sFaWorth = 0;
  for (const row of benignRows) {
    const p = row.rankOf(singleView);
    if (p.rank === 0) continue;
    if (p.rank >= 2) sFaTalk++;
    else sFaWorth++;
    falseAlarms.push({ method: "single_chat", item: row.label, severity: sevOfRank(p.rank), note: p.reason });
  }
  let mFa = 0;
  const benignModHits = (key: string[]) => key.map((k) => modMap.get(k)).filter((r): r is ModRecord => !!r && r.flagged);
  for (const i of benignItems) {
    const hit = benignModHits([`h:${i.id}:title`, `h:${i.id}:search`]);
    if (hit.length) {
      mFa++;
      falseAlarms.push({ method: "moderation", item: itemLabel(i), severity: "flagged", note: `flagged: ${hit[0].topCategory ?? "unknown"}` });
    }
  }
  for (const cv of benignConvs) {
    const hit = benignModHits(cv.messages.filter((m) => m.role === "child").map((m) => `c:${cv.id}:${m.i}`));
    if (hit.length) {
      mFa++;
      falseAlarms.push({ method: "moderation", item: `Chat: “${cv.title}” (${cv.platform})`, severity: "flagged", note: `${hit.length} child message(s) flagged: ${hit[0].topCategory ?? "unknown"}` });
    }
  }

  // ---- AI grades
  const aiGrades: EvalAiGrade[] = [];
  let aiHit = 0;
  const singleGrades: Extras["single"]["grades"] = [];
  for (const g of AI_GRADES) {
    const conv = convsFor({ match: [g.match as ChatMatch] }, prepared.conversations)[0];
    const got = nlViews.flatMap((v) => {
      const a = v.audits.get(conv.id);
      return a ? [a.ai_response.grade] : [];
    });
    const correct = got.filter((x) => g.expected.includes(x)).length;
    if (correct * 2 > n) aiHit++;
    aiGrades.push({ convTitle: g.convTitle, platform: g.platform, expected: g.expected, got, why: g.why });
    singleGrades.push({ title: g.convTitle, platform: g.platform, grade: singleView.audits.get(conv.id)?.ai_response.grade ?? null });
  }

  // ---- consistency across the Nightlight runs (verdict = detected / raised, per signal and per pattern)
  const verdicts: boolean[][] = [...outcomes.map((o) => o.nl.map((e) => e.detected)), ...nlPatternRuns.map((rs) => rs.map((r) => r.detected))];
  const sameAll = (xs: unknown[]) => xs.every((x) => x === xs[0]);
  const consistent = verdicts.filter(sameAll).length;
  const sevCorrect = (o: Outcome, e: SigEval) => (o.sig.expected === "normal" ? !e.detected : e.detected && rk(e.severity) >= expRank(o));
  const sevVerdicts = [...scored.map((o) => o.nl.map((e) => sevCorrect(o, e))), ...nlPatternRuns.map((rs) => rs.map((r) => r.detected))];
  const sevConsistent = sevVerdicts.filter(sameAll).length;
  const verdictFlips = [
    ...outcomes.filter((o) => !sameAll(o.nl.map((e) => e.detected))).map((o) => `${o.sig.id}: ${o.nl.map((e) => (e.detected ? "yes" : "no")).join("/")}`),
    ...PATTERNS.flatMap((p, i) => (sameAll(nlPatternRuns[i].map((r) => r.detected)) ? [] : [`${p.id}: ${nlPatternRuns[i].map((r) => (r.detected ? "yes" : "no")).join("/")}`])),
  ];

  // ---- headline
  const tup = (hit: number, total: number): Score => [hit, total];
  const total = scored.length;
  const patternHits = patterns.map((p) => p.results.nightlight.detected);
  const meanRun = (f: (r: RunRecord) => number) => sum(c.runs.map(f)) / c.runs.length;
  const wasted = sum(c.runs.flatMap((r) => r.attempts.slice(0, -1).map((a) => a.costUsd)));
  const modAi = c.moderation.filter((r) => r.kind === "ai_message");

  const results: EvalResults = {
    generatedAt: c.meta.generatedAt,
    runs: n,
    models: c.meta.models,
    dataset: {
      child: DATASET_FACTS.child,
      ageBand: AGE_BAND,
      days: prepared.stats.perDay.length,
      visits: prepared.stats.totalVisits,
      uniquePages: prepared.stats.uniquePages,
      conversations: prepared.conversations.length,
      plantedSignals: total,
      benignItems: benignItems.length,
      benignConversations: benignConvs.length,
    },
    headline: {
      signalsCaught: {
        moderation: tup(scored.filter((o) => o.mod.detected).length, total),
        single_chat: tup(scored.filter((o) => o.single.detected).length, total),
        nightlight: tup(scored.filter((o) => o.nlDetected).length, total),
      },
      severityCorrect: {
        // moderation has no severity scale, so it can never be "at or above the expected severity": 0 by definition
        moderation: tup(0, total),
        single_chat: tup(scored.filter((o) => sevCorrect(o, o.single)).length, total),
        nightlight: tup(scored.filter((o) => o.nlRank >= expRank(o) && o.nlDetected).length, total),
      },
      patternsFound: {
        moderation: tup(0, PATTERNS.length),
        single_chat: tup(0, PATTERNS.length),
        nightlight: tup(patternHits.filter(Boolean).length, PATTERNS.length),
      },
      normalHandled: {
        moderation: tup(normals.filter((o) => !o.mod.detected).length, normals.length),
        single_chat: tup(normals.filter((o) => !o.single.detected).length, normals.length),
        nightlight: tup(normals.filter((o) => !o.nlDetected).length, normals.length),
      },
      falseAlarms: {
        moderation: { talkSoonOrUrgent: mFa, worthNoticing: 0, outOf },
        single_chat: { talkSoonOrUrgent: sFaTalk, worthNoticing: sFaWorth, outOf },
        nightlight: { talkSoonOrUrgent: nlFaTalk, worthNoticing: nlFaWorth, outOf },
      },
      consistency: round(consistent / verdicts.length, 3),
      aiGradeAccuracy: tup(aiHit, AI_GRADES.length),
      costUsdPerRun: round(meanRun((r) => r.costUsd), 3),
      secondsPerRun: round(meanRun((r) => r.seconds), 1),
    },
    signals,
    patterns,
    aiGrades,
    falseAlarms,
    limitations: [
      "Synthetic data written and labelled by the authors: the same people designed the signals, the rubric and the answer key, so this measures whether the system finds what we planted, not how it performs on real children's data, which is messier.",
      `Small sample: one fictional child, ${prepared.stats.perDay.length} days, ${prepared.conversations.length} conversations, ${total} scored signals and ${PATTERNS.length} patterns. A single miss moves a percentage a lot, and ${n} runs is too few for a confidence interval.`,
      "The answer key and the pattern-detection rules were fixed before the first run and not changed afterwards, but they are still our judgement; expected severities in particular are arguable.",
      "Not a clinical or safeguarding validation. The rubric draws on published frameworks (CO:RE 4Cs, APA, AAP, UNICEF) but has not been checked against clinician judgement, and Nightlight does not diagnose.",
      "The comparison with OpenAI moderation is a comparison of different jobs: moderation is built to catch policy-violating content, not child-development risks, so low scores there show a gap in scope more than a defect.",
      "The single-chat baseline reuses Nightlight's own prompts and model on one chat at a time. It is not ChatGPT's real moderation, and it isolates the value of the cross-conversation step rather than of the rubric.",
      "Only English text, one age band (13-15), one model family (Claude Haiku 5.5 / Sonnet 5.5) and one moderation model were tested. Model outputs vary between runs; see the consistency figure.",
    ],
  };

  const extras: Extras = {
    keySha256,
    keyUnchanged,
    runs: c.runs.map((r) => ({ run: r.run, seconds: r.seconds, costUsd: r.costUsd, llmCalls: r.llmCalls, attempts: r.attempts, pipelineErrors: r.pipelineErrors })),
    single: { seconds: c.single.seconds, costUsd: c.single.costUsd, failed: Object.keys(c.single.errors), grades: singleGrades },
    totalBedrockUsd: sum(c.runs.flatMap((r) => r.attempts.map((a) => a.costUsd))) + c.single.costUsd,
    wastedUsd: wasted,
    consistencyCount: [consistent, verdicts.length],
    severityConsistencyCount: [sevConsistent, sevVerdicts.length],
    falseAlarmsPerRun: perRunFa,
    benignItems: benignItems.length,
    benignConversations: benignConvs.length,
    moderationAi: { flagged: modAi.filter((r) => r.flagged).length, total: modAi.length, top: [...new Set(modAi.filter((r) => r.flagged).map((r) => r.topCategory ?? "unknown"))] },
    moderationInputs: {
      historyInputs: c.moderation.filter((r) => r.kind === "history_title" || r.kind === "history_search").length,
      childMessages: c.moderation.filter((r) => r.kind === "child_message").length,
      aiMessages: modAi.length,
    },
    offDimension,
    verdictFlips,
  };
  return { results, extras };
}

function noteFor(sig: KeySignal, evals: SigEval | SigEval[], method: "single_chat" | "nightlight"): string {
  const list = Array.isArray(evals) ? evals : [evals];
  const n = list.length;
  const normal = sig.expected === "normal";
  const k = list.filter((e) => e.detected).length;
  const prefix = method === "nightlight" ? `${normal ? "raised" : "caught"} in ${k} of ${n} runs; ` : "";
  // The headline uses the per-item flag. Where the final report's top concerns rated it higher, say so.
  const higher = method === "nightlight" && !normal && list.some((e) => rk(e.citedSeverity) > (e.detected ? rk(e.severity) : 0));
  const reportLevel = higher ? `; the report's top concerns citing it, per run: ${list.map((e) => e.citedSeverity ?? "none").join(", ")}` : "";
  if (normal) {
    if (k === 0) return `${prefix}${list.some((e) => e.severity === "normal") ? "marked developmentally normal" : "left alone (correct)"}`;
    const cited = list.some((e) => e.cited);
    return `${prefix}raised as a concern (false alarm)${cited ? ", cited by a top concern" : ""}`;
  }
  if (k === 0) {
    const off = list.map((e) => e.offDimension).find((x) => !!x);
    return `${prefix}missed${off ? `: flagged ${off.dimension} at ${off.severity}, which the key does not accept` : ""}${reportLevel}`;
  }
  const sevs = list.map((e) => (e.detected ? e.severity : "none")).join(", ");
  return method === "nightlight" ? `${prefix}per-run severity: ${sevs}${reportLevel}` : "";
}

// ---------------------------------------------------------------- markdown tables (injected into docs/evaluation.md)

function renderTables(r: EvalResults, x: Extras, mod = true): string {
  const h = r.headline;
  const sc = (s: Score) => `${s[0]} / ${s[1]}`;
  const fa = (m: "moderation" | "single_chat" | "nightlight") => h.falseAlarms[m];
  const L: string[] = [];
  L.push(`_Generated by \`npm run eval\` on ${r.generatedAt}. Do not edit between the markers; rerun the script instead._`, "");
  if (!mod) {
    L.push("> **Moderation baseline not yet run.** The OpenAI key in `.env` was rejected (HTTP 401), so the moderation column is omitted below rather than guessed. Nightlight and single-chat results are real. After fixing `OPENAI_API_KEY`, run `npm run eval -- --resume` (no new Bedrock calls) to add moderation and regenerate this section.", "");
  }
  L.push("### Headline", "");
  const hdr = mod ? ["OpenAI moderation", "Single chat", `Nightlight (${r.runs} runs, majority)`] : ["Single chat", `Nightlight (${r.runs} runs, majority)`];
  L.push(`| Measure | ${hdr.join(" | ")} |`, `|---|${hdr.map(() => "---").join("|")}|`);
  const row = (label: string, mo: string, si: string, ni: string) => L.push(`| ${label} | ${(mod ? [mo, si, ni] : [si, ni]).join(" | ")} |`);
  const fas = (m: "moderation" | "single_chat" | "nightlight", w: boolean) => `${w ? fa(m).worthNoticing : fa(m).talkSoonOrUrgent} of ${fa(m).outOf}`;
  row("Planted signals caught", sc(h.signalsCaught.moderation), sc(h.signalsCaught.single_chat), sc(h.signalsCaught.nightlight));
  row("...and at or above the expected severity", `${sc(h.severityCorrect.moderation)} (no severity scale)`, sc(h.severityCorrect.single_chat), sc(h.severityCorrect.nightlight));
  row("Cross-conversation patterns found", sc(h.patternsFound.moderation), sc(h.patternsFound.single_chat), sc(h.patternsFound.nightlight));
  row("Normal controls left alone", sc(h.normalHandled.moderation), sc(h.normalHandled.single_chat), sc(h.normalHandled.nightlight));
  row("False alarms at talk soon or above (moderation: any flag)", fas("moderation", false), fas("single_chat", false), fas("nightlight", false));
  row("False alarms at worth noticing", "n/a", fas("single_chat", true), fas("nightlight", true));
  row("AI replies graded correctly (majority of runs)", "n/a", "n/a", sc(h.aiGradeAccuracy));
  L.push("", `Nightlight verdict consistency across the ${r.runs} runs: **${x.consistencyCount[0]} of ${x.consistencyCount[1]}** signal/pattern verdicts identical (${(h.consistency * 100).toFixed(1)}%); counting severity-correct verdicts instead: ${x.severityConsistencyCount[0]} of ${x.severityConsistencyCount[1]}.`);
  if (x.verdictFlips.length) L.push("", `Verdicts that changed between runs (yes/no per run): ${x.verdictFlips.join("; ")}.`);
  L.push("", "### Cost and time", "");
  L.push("| Run | Wall time | Estimated Bedrock cost | Model calls | Attempts |", "|---|---|---|---|---|");
  for (const run of x.runs) {
    L.push(`| Nightlight run ${run.run} | ${run.seconds.toFixed(1)} s | $${run.costUsd.toFixed(3)} | ${run.llmCalls} | ${run.attempts.length}${run.attempts.length > 1 ? " (" + run.attempts.filter((a) => !a.ok).map((a) => a.failure).join("; ") + ")" : ""} |`);
  }
  L.push(`| Single-chat audits (16 calls, 4 in parallel) | ${x.single.seconds.toFixed(1)} s | $${x.single.costUsd.toFixed(3)} | 16 | 1 |`);
  L.push("", `Mean per full Nightlight run: ${h.secondsPerRun.toFixed(1)} s and $${h.costUsdPerRun.toFixed(3)}. Total Bedrock spend for this evaluation (all attempts): $${x.totalBedrockUsd.toFixed(3)}. Costs are the routes' own estimates and include the app's 1.25x safety multiplier (lib/pricing.ts), so list-price cost is about 20% lower. OpenAI moderation calls are not included in these figures.`);

  L.push("", "### Per-signal results", "");
  L.push("Expected = minimum severity in the answer key. Moderation has no severity, only flagged or not. Single chat = each conversation audited alone (history flags are Nightlight run 1). Nightlight = per-run result, then the majority verdict.", "");
  L.push(`| Signal | Expected | ${mod ? "Moderation | " : ""}Single chat | Nightlight |`, `|---|---|${mod ? "---|" : ""}---|---|`);
  const cell = (s: EvalSignal, m: MethodResult, isMod: boolean) => {
    if (s.expected === "normal") return m.detected ? "RAISED (false alarm)" : "left alone (correct)";
    if (!m.detected) return "missed";
    if (isMod) return "flagged";
    return `${m.severity}${rk(m.severity) < rk(s.expected as Severity) ? " (below expected)" : ""}`;
  };
  for (const s of r.signals) {
    const nl = s.results.nightlight;
    const runs = (nl.runs ?? []).map((q) => (s.expected === "normal" ? (q.detected ? "raised" : "ok") : q.detected ? q.severity : "missed")).join(" / ");
    const rl = /; the report's top concerns citing it, per run: (.*)$/.exec(nl.note ?? "");
    const nlCell = `${cell(s, nl, false)} [${runs}]${rl ? ` (top concerns citing it: ${rl[1]})` : ""}`;
    const modCell = mod ? `${cell(s, s.results.moderation, true)}${s.results.moderation.detected && s.expected !== "normal" ? " (" + s.results.moderation.note?.replace(/^flagged: /, "").replace(/ \(.*$/, "") + ")" : ""} | ` : "";
    L.push(`| ${s.id}: ${s.label.replace(/\|/g, "/")} | ${s.expected} (${s.dimension}${s.acceptable.length ? "/" + s.acceptable.join("/") : ""}) | ${modCell}${cell(s, s.results.single_chat, false)} | ${nlCell} |`);
  }

  L.push("", "### Cross-conversation patterns", "");
  L.push(`| Pattern | Rule | ${mod ? "Moderation | " : ""}Single chat | Nightlight |`, `|---|---|${mod ? "---|" : ""}---|---|`);
  for (const p of r.patterns) {
    L.push(`| ${p.id}: ${p.title} | ${p.rule} | ${mod ? "no | " : ""}no | ${p.nightlight.runsDetected} of ${p.nightlight.runs} runs${p.nightlight.direction ? ", trend " + p.nightlight.direction : ""}${p.nightlight.severity ? ", severity " + p.nightlight.severity : ""} |`);
  }
  L.push("", "Notes per pattern:", "");
  for (const p of r.patterns) {
    L.push(`- **${p.id}**. Nightlight: ${p.results.nightlight.note} Single chat: ${p.results.single_chat.note}${mod ? ` Moderation: ${p.results.moderation.note}` : ""}`);
  }
  L.push("", "### Single-chat isolation (each chat audited on its own)", "");
  L.push("| Pattern | Chat | Platform | Highest severity alone | Mood |", "|---|---|---|---|---|");
  for (const p of r.patterns) for (const i of p.isolation) L.push(`| ${p.id} | ${i.convTitle} | ${i.platform} | ${i.isolatedSeverity} | ${i.mood ?? "n/a"} |`);

  L.push("", "### AI reply grading", "");
  L.push("| Chat | Platform | Correct grade(s) | Nightlight, runs 1-3 | Single chat | Majority correct |", "|---|---|---|---|---|---|");
  r.aiGrades.forEach((g, i) => {
    const ok = g.got.filter((q) => g.expected.includes(q)).length * 2 > r.runs;
    L.push(`| ${g.convTitle} | ${g.platform} | ${g.expected.join(" or ")} | ${g.got.join(" / ")} | ${x.single.grades[i].grade ?? "n/a"} | ${ok ? "yes" : "no"} |`);
  });

  L.push("", "### False alarms (every benign item that was flagged)", "");
  L.push(`Benign controls: ${x.benignItems} browsing items on clearly benign domains and ${x.benignConversations} benign chats (algebra, photosynthesis, Minecraft), ${x.benignItems + x.benignConversations} in total.`, "");
  L.push(`Per-run Nightlight false alarms (talk soon or above / worth noticing): ${x.falseAlarmsPerRun.map((q, i) => `run ${i + 1}: ${q.talkSoonOrUrgent} / ${q.worthNoticing}`).join("; ")}.`, "");
  if (!r.falseAlarms.length) L.push(mod ? "None: no benign item was flagged by any method." : "None: no benign item was flagged by Nightlight or the single-chat audits.");
  else {
    L.push("| Method | Benign item | Severity | Note |", "|---|---|---|---|");
    for (const f of r.falseAlarms) L.push(`| ${f.method} | ${f.item.replace(/\|/g, "/")} | ${f.severity} | ${(f.note ?? "").replace(/\|/g, "/")} |`);
  }
  L.push("", "### Benign domains excluded from the controls", "");
  for (const e of BENIGN_EXCLUSIONS) L.push(`- ${e}`);
  L.push("", "### Moderation inputs", "");
  if (!mod) L.push("Not yet run (see the note at the top of this section).");
  else L.push(`${x.moderationInputs.historyInputs} history titles/searches and ${x.moderationInputs.childMessages} child messages were sent to ${r.models.moderation} (headline). The ${x.moderationInputs.aiMessages} AI-side messages were also run, reported separately: ${x.moderationAi.flagged} flagged${x.moderationAi.top.length ? " (" + x.moderationAi.top.join(", ") + ")" : ""}.`);
  if (x.offDimension.length) {
    L.push("", "### Misses where the model flagged a different dimension", "");
    for (const o of x.offDimension) L.push(`- ${o}`);
  }
  L.push("", `Answer key SHA-256 at collection time: \`${x.keySha256}\`${x.keyUnchanged ? " (unchanged at scoring time)" : " (CHANGED since the raw runs were collected)"}.`);
  return L.join("\n");
}

function injectDoc(tables: string) {
  if (!fs.existsSync(DOC_PATH)) return console.log("docs/evaluation.md not found; skipped table injection");
  const doc = fs.readFileSync(DOC_PATH, "utf8");
  const a = doc.indexOf(TABLES_START);
  const b = doc.indexOf(TABLES_END);
  if (a < 0 || b < a) return console.log("table markers not found in docs/evaluation.md; skipped injection (tables are in eval/out/tables.md)");
  fs.writeFileSync(DOC_PATH, `${doc.slice(0, a + TABLES_START.length)}\n\n${tables}\n\n${doc.slice(b)}`);
}

// ---------------------------------------------------------------- runtime shape check (the tsc check lives in eval/results-check.ts)

function assertShape(r: EvalResults) {
  const bad: string[] = [];
  const sev = new Set<string>([...SEVS, "none", "flagged"]);
  for (const s of r.signals) {
    if (s.id === "" || !s.label || !s.date) bad.push(`signal ${s.id} incomplete`);
    for (const m of ["moderation", "single_chat", "nightlight"] as const) {
      const sv = s.results[m].severity;
      if (sv != null && !sev.has(sv)) bad.push(`${s.id}.${m} severity ${sv}`);
    }
    if (s.results.nightlight.runs?.length !== r.runs) bad.push(`${s.id} nightlight runs`);
  }
  for (const p of r.patterns) if (p.isolation.length === 0 && p.evidence.some((e) => e.signalId.startsWith("c-"))) bad.push(`${p.id} isolation empty`);
  for (const k of ["signalsCaught", "severityCorrect", "patternsFound", "normalHandled"] as const)
    for (const m of ["moderation", "single_chat", "nightlight"] as const) if (r.headline[k][m][0] > r.headline[k][m][1]) bad.push(`headline.${k}.${m}`);
  if (bad.length) throw new Error(`Result shape problems: ${bad.join("; ")}`);
}

// ---------------------------------------------------------------- main

const friendlyModel = (id: string | undefined) => {
  const m = id ? /claude-(haiku|sonnet|opus)-(\d+)-(\d+)/i.exec(id) : null;
  return m ? `Claude ${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}.${m[3]}` : "unknown";
};

function printHeadline(results: EvalResults, extras: Extras, mod = true) {
  const h = results.headline;
  const s = (x: Score, isMod = false) => (isMod && !mod ? "n/a" : `${x[0]}/${x[1]}`);
  console.log("\nheadline (moderation | single chat | nightlight)");
  for (const k of ["signalsCaught", "severityCorrect", "patternsFound", "normalHandled"] as const) {
    console.log(`  ${k.padEnd(16)} ${s(h[k].moderation, true)} | ${s(h[k].single_chat)} | ${s(h[k].nightlight)}`);
  }
  for (const m of (mod ? (["moderation", "single_chat", "nightlight"] as const) : (["single_chat", "nightlight"] as const))) console.log(`  false alarms ${m}: ${h.falseAlarms[m].talkSoonOrUrgent} (talk soon+) / ${h.falseAlarms[m].worthNoticing} (worth noticing) of ${h.falseAlarms[m].outOf}`);
  console.log(`  consistency ${h.consistency}, AI grades ${s(h.aiGradeAccuracy)}, ${h.secondsPerRun}s and $${h.costUsdPerRun} per run, total Bedrock $${extras.totalBedrockUsd.toFixed(3)}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(path.join(ROOT, "package.json"))) throw new Error("Run from the project root (npm run eval).");
  const keySha256 = crypto.createHash("sha256").update(fs.readFileSync(KEY_PATH)).digest("hex");
  const prepared = await loadPrepared();
  checkKeyMatchers(prepared);
  console.log(`dataset: ${prepared.stats.totalVisits} visits, ${prepared.historyItems.length} unique items, ${prepared.conversations.length} conversations; key ${keySha256.slice(0, 12)}`);

  let meta: Meta;
  if (SCORE_ONLY) {
    if (!exists("meta.json")) throw new Error("No raw output in eval/out/ to score. Run `npm run eval` first.");
    meta = readJson<Meta>("meta.json");
  } else {
    installConsoleTap();
    const smart = process.env.CLAUDE_AWS_MODEL;
    meta = {
      generatedAt: new Date().toISOString(),
      keySha256,
      node: process.version,
      tz: process.env.TZ ?? "",
      models: { fast: friendlyModel(process.env.CLAUDE_AWS_FAST_MODEL || smart), smart: friendlyModel(smart), moderation: MODERATION_MODEL },
    };
    if (RESUME && exists("meta.json")) {
      const old = readJson<Meta>("meta.json");
      if (old.keySha256 !== keySha256) throw new Error("--resume refused: the answer key changed since the saved raw output was collected.");
      meta = old;
    }

    // 1. moderation (free, fast): first, so a bad OpenAI key fails before any Bedrock money is spent
    if (SKIP_MODERATION) console.log("moderation: skipped (--skip-moderation); results will not be scored until it has run");
    else if (!(RESUME && exists("moderation.json"))) writeJson("moderation.json", await runModeration(prepared));
    writeJson("meta.json", meta);
    if (ONLY_MODERATION) {
      const mod = readJson<ModRecord[]>("moderation.json");
      console.log(`moderation done: ${mod.filter((r) => r.flagged).length} of ${mod.length} inputs flagged. Stopping (--only-moderation).`);
      return;
    }

    // 2. Nightlight: full pipeline, 3 runs, through the real route handlers
    const { POST: classifyHistory } = await import("../app/api/classify-history/route");
    const { POST: auditChats } = await import("../app/api/audit-chats/route");
    const { POST: summarize } = await import("../app/api/summarize/route");
    const { runDemo } = await import("../lib/pipeline");
    installFetchShim({ "/api/classify-history": classifyHistory, "/api/audit-chats": auditChats, "/api/summarize": summarize });
    for (let run = 1; run <= NIGHTLIGHT_RUNS; run++) {
      const file = `nightlight-run-${run}.json`;
      if (RESUME && exists(file)) {
        console.log(`nightlight run ${run}: reusing ${file}`);
        continue;
      }
      console.log(`nightlight run ${run} of ${NIGHTLIGHT_RUNS}`);
      const rec = await collectNightlightRun(run, runDemo);
      writeJson(file, rec);
      console.log(`  run ${run} done: ${rec.seconds.toFixed(1)} s, $${rec.costUsd.toFixed(3)}, ${rec.attempts.length} attempt(s)`);
    }

    // 3. single chat, one conversation at a time
    if (!(RESUME && exists("single-chat.json"))) {
      console.log("single-chat audits");
      const rec = await collectSingleChat(prepared, auditChats);
      writeJson("single-chat.json", rec);
      console.log(`  done: ${rec.seconds.toFixed(1)} s, $${rec.costUsd.toFixed(3)}, failed: ${Object.keys(rec.errors).length}`);
    }
  }

  // 4. score
  const haveModeration = exists("moderation.json");
  if (!haveModeration && !PREVIEW) {
    throw new Error(
      "Bedrock output is saved in eval/out/, but there is no moderation output yet, so nothing was scored and data/eval-results.json was left untouched. " +
        "Fix OPENAI_API_KEY and run `npm run eval -- --resume`.",
    );
  }
  const collected: Collected = {
    meta,
    moderation: haveModeration ? readJson<ModRecord[]>("moderation.json") : [],
    runs: Array.from({ length: NIGHTLIGHT_RUNS }, (_, i) => readJson<RunRecord>(`nightlight-run-${i + 1}.json`)),
    single: readJson<SingleChatRecord>("single-chat.json"),
  };
  const keyUnchanged = meta.keySha256 === keySha256;
  if (!keyUnchanged) console.warn("WARNING: the answer key differs from the one used when the raw output was collected.");
  const { results, extras } = score(prepared, collected, keyUnchanged, meta.keySha256);
  assertShape(results);
  if (!haveModeration) {
    // PREVIEW without moderation: every moderation cell would read "not flagged", which is NOT a measurement.
    const noMod = renderTables(results, extras, false);
    fs.writeFileSync(outFile("tables-preview.md"), `${noMod}
`);
    injectDoc(noMod);
    console.log("PREVIEW (no moderation output): wrote eval/out/tables-preview.md and the moderation-free tables into docs/evaluation.md; data/eval-results.json untouched.");
    printHeadline(results, extras, false);
    return;
  }
  fs.rmSync(outFile("tables-preview.md"), { force: true }); // superseded by tables.md
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2) + "\n");
  const tables = renderTables(results, extras);
  fs.writeFileSync(outFile("tables.md"), tables + "\n");
  writeJson("extras.json", extras);
  injectDoc(tables);

  printHeadline(results, extras);
  console.log(`wrote ${path.relative(ROOT, RESULTS_PATH)}`);
}

main().catch((e) => {
  console.error(text(e));
  process.exitCode = 1;
});
