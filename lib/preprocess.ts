// Turns parsed files into the compact, de-duplicated, PII-redacted data that is analysed and displayed.
// Runs in the browser. Nothing here is silently dropped: anything cut for budget reasons is counted in `stats.analysed`.
import { matchAiApp } from "./ai-apps";
import { redact, redactText } from "./redact";
import type {
  AiAppUsage,
  ChatMessage,
  Conversation,
  HistoryItem,
  LocalStats,
  ParsedFile,
  PiiHit,
  PreparedConversation,
  PreparedData,
  ReportSource,
  Visit,
} from "./types";

export interface PrepareOptions {
  /** max deduped history items sent for analysis (default 2000) */
  maxHistoryItems?: number;
  /** max conversations sent for analysis (default 60) */
  maxConversations?: number;
}

// ---------------------------------------------------------------- URL handling

interface UrlInfo {
  domain: string;
  path: string;
  search?: string;
}

interface SearchRule {
  host: RegExp;
  path: RegExp;
  param: string;
}

const SEARCH_RULES: SearchRule[] = [
  { host: /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/, path: /^\/search\/?$/, param: "q" },
  { host: /(^|\.)bing\.com$/, path: /^\/search\/?$/, param: "q" },
  { host: /(^|\.)duckduckgo\.com$/, path: /^\/(html\/?)?$/, param: "q" },
  { host: /(^|\.)youtube\.com$/, path: /^\/results\/?$/, param: "search_query" },
  { host: /(^|\.)tiktok\.com$/, path: /^\/search/, param: "q" },
  { host: /(^|\.)yahoo\.com$/, path: /^\/search/, param: "p" },
  { host: /(^|\.)ecosia\.org$/, path: /^\/search/, param: "q" },
  { host: /(^|\.)pinterest\.[a-z.]{2,}$/, path: /^\/search\//, param: "q" },
  { host: /(^|\.)reddit\.com$/, path: /^\/(r\/[^/]+\/)?search\/?$/, param: "q" },
  { host: /(^|\.)search\.brave\.com$/, path: /^\/search/, param: "q" },
];

const ID_SEGMENT = /^(?=.*\d)[A-Za-z0-9_-]{22,}$/;
const MAX_PATH = 120;
const MAX_TITLE = 160;
const MAX_SEARCH = 200;

function extractSearch(domain: string, pathname: string, params: URLSearchParams): string | undefined {
  for (const rule of SEARCH_RULES) {
    if (rule.host.test(domain) && rule.path.test(pathname)) {
      const q = params.get(rule.param);
      if (q) {
        const cleaned = q.replace(/\s+/g, " ").trim();
        if (cleaned) return cleaned.slice(0, MAX_SEARCH);
      }
      return undefined;
    }
  }
  return undefined;
}

export function analyzeUrl(raw: string): UrlInfo | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const domain = u.hostname.toLowerCase().replace(/^www\./, "");
  if (!domain) return null;
  const search = extractSearch(domain, u.pathname, u.searchParams);
  let path = u.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  // Opaque document / video ids make paths long and tell the model nothing.
  path = path
    .split("/")
    .map((seg) => (ID_SEGMENT.test(seg) ? ":id" : seg))
    .join("/");
  if (path.length > MAX_PATH) path = path.slice(0, MAX_PATH) + "…";
  return { domain, path, ...(search ? { search } : {}) };
}

function cleanTitle(title: string): string {
  let t = (title ?? "").replace(/\s+/g, " ").trim();
  t = t.replace(/^\(\d+\)\s*/, ""); // "(3) YouTube" notification counters
  return t.length > MAX_TITLE ? t.slice(0, MAX_TITLE) + "…" : t;
}

// ---------------------------------------------------------------- local-time helpers

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isLateNight = (d: Date) => d.getHours() < 5;
/** Monday = 0 ... Sunday = 6 */
const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7;

// ---------------------------------------------------------------- conversations

const MSG_CAP = 2000;
const CONV_CHAR_BUDGET = 12_000;
const HARD_CHAR_BUDGET = 24_000;
const KEEP_HEAD = 6;
const KEEP_TAIL = 20;

function totalChars(msgs: ChatMessage[]) {
  return msgs.reduce((n, m) => n + m.text.length, 0);
}

function prepareConversation(c: Conversation): { conv: PreparedConversation; pii: PiiHit[] } {
  let shortened = false;
  let msgs: ChatMessage[] = c.messages.map((m) => {
    if (m.text.length <= MSG_CAP) return m;
    shortened = true;
    return { ...m, text: m.text.slice(0, MSG_CAP).trimEnd() + "…" };
  });

  if (totalChars(msgs) > CONV_CHAR_BUDGET) {
    if (msgs.length > KEEP_HEAD + KEEP_TAIL) {
      msgs = [...msgs.slice(0, KEEP_HEAD), ...msgs.slice(-KEEP_TAIL)];
      shortened = true;
    }
    // Still too big (many long messages)? Drop the oldest of the tail, never the opening exchange.
    while (totalChars(msgs) > HARD_CHAR_BUDGET && msgs.length > KEEP_HEAD + 4) {
      msgs.splice(KEEP_HEAD, 1);
      shortened = true;
    }
  }

  const pii: PiiHit[] = [];
  const prepared = msgs.map((m, i) => {
    const r = redact(m.text);
    if (m.role === "child") {
      for (const h of r.hits) pii.push({ type: h.type, conversationId: c.id, messageIndex: i, preview: h.preview });
    }
    return { i, role: m.role, text: r.text, ...(m.ts != null ? { ts: m.ts } : {}) };
  });

  const startedAt = c.startedAt ?? c.messages.find((m) => m.ts != null)?.ts;
  return {
    conv: {
      id: c.id,
      platform: c.platform,
      title: redactText(c.title),
      ...(startedAt != null ? { startedAt } : {}),
      messages: prepared,
      truncated: shortened,
    },
    pii,
  };
}

// ---------------------------------------------------------------- main

interface Acc {
  domain: string;
  path: string;
  title: string;
  search?: string;
  visits: number;
  first: number;
  last: number;
  late: number;
}

const byImportance = (a: Acc, b: Acc) =>
  b.visits - a.visits || b.late - a.late || b.last - a.last;

export function prepare(files: ParsedFile[], opts: PrepareOptions = {}): PreparedData {
  const maxHistoryItems = opts.maxHistoryItems ?? 2000;
  const maxConversations = opts.maxConversations ?? 60;

  // ---- sources
  const sources: ReportSource[] = files.map((f) => ({
    kind: f.data.source,
    label: f.data.label,
    fileName: f.fileName,
    count: f.kind === "history" ? f.data.visits.length : f.data.conversations.length,
  }));

  // ---- activity accumulators (history visits + child chat messages)
  const days = new Map<string, { visits: number; lateNight: number }>();
  const heatmap: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  let activity = 0;
  let lateActivity = 0;
  const addActivity = (ts: number) => {
    const d = new Date(ts);
    const late = isLateNight(d);
    const key = dayKey(d);
    const day = days.get(key) ?? { visits: 0, lateNight: 0 };
    day.visits++;
    if (late) day.lateNight++;
    days.set(key, day);
    heatmap[weekdayIndex(d)][d.getHours()]++;
    activity++;
    if (late) lateActivity++;
  };

  // ---- history
  const urlCache = new Map<string, UrlInfo | null>();
  const seenVisit = new Set<string>(); // same visit present in two files (e.g. Chrome + Takeout)
  const items = new Map<string, Acc>();
  const domainCounts = new Map<string, number>();
  const aiApps = new Map<string, AiAppUsage>();
  let totalVisits = 0;
  let searchCount = 0;
  let rangeStart = Infinity;
  let rangeEnd = -Infinity;

  const historyFiles = files.filter((f) => f.kind === "history");
  const multiFile = historyFiles.length > 1;
  for (const f of historyFiles) {
    if (f.kind !== "history") continue;
    for (const v of f.data.visits as Visit[]) {
      let info = urlCache.get(v.url);
      if (info === undefined) {
        info = analyzeUrl(v.url);
        urlCache.set(v.url, info);
      }
      if (!info || !Number.isFinite(v.ts)) continue;
      if (multiFile) {
        const k = `${v.ts}|${v.url}`;
        if (seenVisit.has(k)) continue;
        seenVisit.add(k);
      }

      const d = new Date(v.ts);
      const late = isLateNight(d);
      totalVisits++;
      if (v.ts < rangeStart) rangeStart = v.ts;
      if (v.ts > rangeEnd) rangeEnd = v.ts;
      addActivity(v.ts);
      domainCounts.set(info.domain, (domainCounts.get(info.domain) ?? 0) + 1);

      const app = matchAiApp(info.domain);
      if (app) {
        const u = aiApps.get(app.domain) ?? { domain: app.domain, name: app.name, kind: app.kind, visits: 0, lateNight: 0 };
        u.visits++;
        if (late) u.lateNight++;
        aiApps.set(app.domain, u);
      }

      const title = cleanTitle(v.title);
      const key = info.search
        ? `${info.domain}|S|${info.search.toLowerCase()}`
        : `${info.domain}|${info.path}|${title}`;
      if (info.search) searchCount++;
      const acc = items.get(key);
      if (acc) {
        acc.visits++;
        if (v.ts < acc.first) acc.first = v.ts;
        if (v.ts > acc.last) acc.last = v.ts;
        if (late) acc.late++;
      } else {
        items.set(key, {
          domain: info.domain,
          path: info.path,
          title,
          ...(info.search ? { search: info.search } : {}),
          visits: 1,
          first: v.ts,
          last: v.ts,
          late: late ? 1 : 0,
        });
      }
    }
  }

  // ---- choose what gets analysed (never silently)
  const all = [...items.values()];
  let chosen = all;
  if (all.length > maxHistoryItems) {
    const searches = all.filter((a) => a.search).sort(byImportance);
    const pages = all.filter((a) => !a.search).sort(byImportance);
    chosen = searches.slice(0, maxHistoryItems);
    if (chosen.length < maxHistoryItems) chosen = chosen.concat(pages.slice(0, maxHistoryItems - chosen.length));
  }
  chosen = [...chosen].sort((a, b) => b.last - a.last || b.visits - a.visits);

  const historyItems: HistoryItem[] = chosen.map((a, idx) => {
    const search = a.search ? redactText(a.search) : undefined;
    return {
      id: idx + 1,
      domain: a.domain,
      path: a.path,
      title: redactText(a.title),
      ...(search ? { search } : {}),
      visits: a.visits,
      firstSeen: a.first,
      lastSeen: a.last,
      lateNight: a.late,
    };
  });

  // ---- conversations
  const seenConv = new Set<string>();
  const allConvs: Conversation[] = [];
  for (const f of files) {
    if (f.kind !== "chats") continue;
    for (const c of f.data.conversations) {
      const k = `${c.platform}|${c.id}`;
      if (seenConv.has(k)) continue;
      seenConv.add(k);
      allConvs.push(c);
    }
  }
  let childMessages = 0;
  for (const c of allConvs) {
    for (const m of c.messages) {
      if (m.role !== "child") continue;
      childMessages++;
      if (m.ts != null) addActivity(m.ts);
    }
  }
  const startOf = (c: Conversation) => c.startedAt ?? c.messages.find((m) => m.ts != null)?.ts ?? 0;
  const newestFirst = [...allConvs].sort((a, b) => startOf(b) - startOf(a));
  const keptConvs = newestFirst.slice(0, maxConversations);

  const conversations: PreparedConversation[] = [];
  const pii: PiiHit[] = [];
  for (const c of keptConvs) {
    const r = prepareConversation(c);
    conversations.push(r.conv);
    pii.push(...r.pii);
  }

  // ---- stats
  const stats: LocalStats = {
    totalVisits,
    uniquePages: all.length,
    uniqueDomains: domainCounts.size,
    searchCount,
    range: totalVisits > 0 ? { start: rangeStart, end: rangeEnd } : null,
    perDay: [...days.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, v]) => ({ date, visits: v.visits, lateNight: v.lateNight })),
    heatmap,
    lateNightShare: activity > 0 ? lateActivity / activity : 0,
    topDomains: [...domainCounts.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, 10)
      .map(([domain, visits]) => ({ domain, visits })),
    aiApps: [...aiApps.values()].sort((a, b) => b.visits - a.visits),
    conversations: allConvs.length,
    childMessages,
    analysed: {
      historyItems: historyItems.length,
      historyTotal: all.length,
      conversations: conversations.length,
      conversationsTotal: allConvs.length,
    },
  };

  return { sources, historyItems, conversations, pii, stats };
}
