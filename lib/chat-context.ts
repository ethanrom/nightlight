// Builds the compact, model-friendly context the "Ask Nightlight" chat sends with each question.
// It runs in the browser (so dates and times are the parent's/child's LOCAL time) and the result is sent on
// every chat request, so it is deliberately compact: tuples instead of objects for the bulk history list, and
// only the messages around flagged moments instead of whole conversations. PII is already redacted upstream.
import type { AgeBand, DietCategory, DimensionId, Severity } from "./rubric";
import { SEVERITY_META } from "./rubric";
import type { Report, Summary } from "./types";

/** [id, domain, title or "search: <query>", visits, last seen (local YYYY-MM-DD)] */
export type HistoryTuple = [number, string, string, number, string];

export interface ChatContextFlaggedHistory {
  ref: string; // "h:<id>"
  domain: string;
  title: string;
  search?: string;
  dimension: DimensionId;
  severity: Severity;
  developmentally_normal: boolean;
  reason: string;
  visits: number;
  late_night_visits?: number;
  last_seen: string;
}

export interface ChatContextMessage {
  i: number;
  role: "child" | "ai";
  /** local HH:MM when known */
  t?: string;
  text: string;
}

export interface ChatContextConversation {
  id: string;
  platform: string;
  title: string;
  date?: string;
  /** local HH:MM the conversation started, when known */
  started_at?: string;
  /** true when it started between midnight and 5am local time */
  after_midnight?: boolean;
  messages_total: number;
  audited: boolean;
  mood?: number;
  reliance?: "none" | "some" | "high";
  topics?: string[];
  summary?: string;
  ai_response?: { grade: string; missed_opportunities: string[]; notes: string };
  flags: {
    ref: string; // "c:<conversation id>:<message index>"
    message_index: number;
    dimension: DimensionId;
    severity: Severity;
    developmentally_normal: boolean;
    explanation: string;
  }[];
  /** the flagged messages plus one message either side, so the chat can see what was going on */
  key_messages: ChatContextMessage[];
}

export interface ChatContext {
  child: { name?: string; age_band: AgeBand };
  report_generated: string;
  period: { start: string; end: string } | null;
  coverage: {
    note: string;
    history_items_analysed?: number;
    history_items_found?: number;
    conversations_analysed?: number;
    conversations_found?: number;
    history_list_truncated_by: number;
  };
  stats: {
    total_visits: number;
    unique_pages: number;
    unique_domains: number;
    searches: number;
    late_night_share_percent: number;
    top_domains: { domain: string; visits: number }[];
    ai_apps: { name: string; kind: string; visits: number; late_night_visits: number }[];
    conversations: number;
    child_messages: number;
    late_night_days: { date: string; late_night_visits: number }[];
    /** activity (visits + child chat messages) in each hour between midnight and 5am, all days combined */
    late_night_by_hour: { hour: string; activity: number }[];
    visits_by_category: Partial<Record<DietCategory, number>>;
  };
  summary: Summary | null;
  flagged_history: ChatContextFlaggedHistory[];
  history_tuple_columns: ["id", "domain", "title_or_search", "visits", "last_seen"];
  /** every analysed history item EXCEPT the flagged ones above (those are listed in full), busiest first */
  history: HistoryTuple[];
  conversations: ChatContextConversation[];
  personal_info_shared: { ref: string; type: string; preview: string }[];
  analysis_problems: string[];
}

// ---------------------------------------------------------------- limits

const MAX_HISTORY_TUPLES = 1500;
const MAX_TITLE_CHARS = 70;
const MAX_FLAG_WINDOWS = 80;
const MAX_MESSAGE_CHARS = 500;
/** Rough token ceiling for the serialised context (well below the 80k target). */
const TARGET_TOKENS = 60_000;
const CHARS_PER_TOKEN = 3.4;

// ---------------------------------------------------------------- helpers

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function localTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

// ---------------------------------------------------------------- builder

export function buildChatContext(report: Report): ChatContext {
  let historyCap = MAX_HISTORY_TUPLES;
  let windowCap = MAX_FLAG_WINDOWS;
  let messageChars = MAX_MESSAGE_CHARS;
  let ctx = assemble(report, historyCap, windowCap, messageChars);
  // Shrink the bulkiest parts until we are comfortably inside the token budget.
  for (let attempt = 0; attempt < 6 && estimateTokens(ctx) > TARGET_TOKENS; attempt++) {
    historyCap = Math.floor(historyCap * 0.6);
    if (attempt >= 1) windowCap = Math.floor(windowCap * 0.75);
    if (attempt >= 2) messageChars = Math.max(200, Math.floor(messageChars * 0.7));
    ctx = assemble(report, historyCap, windowCap, messageChars);
  }
  return ctx;
}

export function estimateTokens(ctx: unknown): number {
  return Math.ceil(JSON.stringify(ctx).length / CHARS_PER_TOKEN);
}

function assemble(report: Report, historyCap: number, windowCap: number, messageChars: number): ChatContext {
  const { stats } = report;
  const flagsById = new Map<number, Report["historyFlags"][number][]>();
  for (const f of report.historyFlags) {
    const list = flagsById.get(f.id) ?? [];
    list.push(f);
    flagsById.set(f.id, list);
  }
  const itemById = new Map(report.historyItems.map((it) => [it.id, it]));

  // ---- flagged history joined with titles (strongest first)
  const flaggedHistory: ChatContextFlaggedHistory[] = [];
  for (const f of report.historyFlags) {
    const it = itemById.get(f.id);
    if (!it) continue;
    flaggedHistory.push({
      ref: `h:${f.id}`,
      domain: it.domain,
      title: clip(it.title, 120),
      ...(it.search ? { search: clip(it.search, 140) } : {}),
      dimension: f.dimension,
      severity: f.severity,
      developmentally_normal: f.developmentally_normal,
      reason: f.reason,
      visits: it.visits,
      ...(it.lateNight > 0 ? { late_night_visits: it.lateNight } : {}),
      last_seen: localDate(it.lastSeen),
    });
  }
  flaggedHistory.sort((a, b) => SEVERITY_META[b.severity].rank - SEVERITY_META[a.severity].rank);

  // ---- bulk history as tuples (unflagged items, busiest first, capped)
  const unflagged = report.historyItems.filter((it) => !flagsById.has(it.id));
  unflagged.sort((a, b) => b.visits - a.visits || b.lastSeen - a.lastSeen);
  const history: HistoryTuple[] = unflagged
    .slice(0, historyCap)
    .map((it) => [
      it.id,
      it.domain,
      it.search ? `search: ${clip(it.search, MAX_TITLE_CHARS)}` : clip(it.title || it.path, MAX_TITLE_CHARS),
      it.visits,
      localDate(it.lastSeen),
    ]);
  const historyTruncatedBy = Math.max(0, unflagged.length - history.length);

  // ---- visits by diet category
  const catByDomain = new Map(report.domainCategories.map((d) => [d.domain, d.category]));
  const visitsByCategory: Partial<Record<DietCategory, number>> = {};
  for (const it of report.historyItems) {
    const cat = catByDomain.get(it.domain);
    if (cat) visitsByCategory[cat] = (visitsByCategory[cat] ?? 0) + it.visits;
  }

  // ---- conversations: audits + key messages around flagged messages
  const auditById = new Map(report.chatAudits.map((a) => [a.id, a]));
  const convs = [...report.conversations].sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));

  // Choose which flagged windows to keep when over budget: most severe first.
  type FlagRef = { convId: string; severity: Severity };
  const allFlags: (FlagRef & { idx: number })[] = [];
  for (const a of report.chatAudits) for (const f of a.flags) allFlags.push({ convId: a.id, severity: f.severity, idx: f.message_index });
  allFlags.sort((a, b) => SEVERITY_META[b.severity].rank - SEVERITY_META[a.severity].rank);
  const keptWindows = new Set(allFlags.slice(0, windowCap).map((f) => `${f.convId}:${f.idx}`));

  const conversations: ChatContextConversation[] = convs.map((c) => {
    const audit = auditById.get(c.id);
    const flagsOut: ChatContextConversation["flags"] = [];
    const wanted = new Set<number>();
    if (audit) {
      for (const f of audit.flags) {
        flagsOut.push({
          ref: `c:${c.id}:${f.message_index}`,
          message_index: f.message_index,
          dimension: f.dimension,
          severity: f.severity,
          developmentally_normal: f.developmentally_normal,
          explanation: f.explanation,
        });
        if (keptWindows.has(`${c.id}:${f.message_index}`)) {
          for (const i of [f.message_index - 1, f.message_index, f.message_index + 1]) wanted.add(i);
        }
      }
    }
    const keyMessages: ChatContextMessage[] = c.messages
      .filter((m) => wanted.has(m.i))
      .map((m) => ({
        i: m.i,
        role: m.role,
        ...(m.ts ? { t: localTime(m.ts) } : {}),
        text: clip(m.text, messageChars),
      }));
    return {
      id: c.id,
      platform: c.platform,
      title: clip(c.title, 100),
      ...(c.startedAt
        ? {
            date: localDate(c.startedAt),
            started_at: localTime(c.startedAt),
            ...(new Date(c.startedAt).getHours() < 5 ? { after_midnight: true } : {}),
          }
        : {}),
      messages_total: c.messages.length,
      audited: !!audit,
      ...(audit
        ? {
            mood: audit.child_mood,
            reliance: audit.reliance_level,
            topics: audit.topics,
            summary: audit.summary,
            ai_response: {
              grade: audit.ai_response.grade,
              missed_opportunities: audit.ai_response.missed_opportunities,
              notes: audit.ai_response.notes,
            },
          }
        : {}),
      flags: flagsOut,
      key_messages: keyMessages,
    };
  });

  // ---- local stats
  const lateDays = [...stats.perDay]
    .filter((d) => d.lateNight > 0)
    .sort((a, b) => b.lateNight - a.lateNight)
    .slice(0, 10)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ date: d.date, late_night_visits: d.lateNight }));

  const lateByHour = [0, 1, 2, 3, 4].map((h) => ({
    hour: `${pad(h)}:00`,
    activity: stats.heatmap.reduce((sum, row) => sum + (row?.[h] ?? 0), 0),
  }));

  const problems = report.errors.map((e) => `${e.stage}: ${e.message}${e.affected ? ` (${e.affected} affected)` : ""}`);

  return {
    child: { ...(report.childName?.trim() ? { name: report.childName.trim().slice(0, 30) } : {}), age_band: report.ageBand },
    report_generated: localDate(report.generatedAt),
    period: stats.range ? { start: localDate(stats.range.start), end: localDate(stats.range.end) } : null,
    coverage: {
      note:
        "Only the items counted here were analysed; the history list below is capped, so absence from it does not prove the child never visited something.",
      history_items_analysed: stats.analysed?.historyItems,
      history_items_found: stats.analysed?.historyTotal,
      conversations_analysed: stats.analysed?.conversations,
      conversations_found: stats.analysed?.conversationsTotal,
      history_list_truncated_by: historyTruncatedBy,
    },
    stats: {
      total_visits: stats.totalVisits,
      unique_pages: stats.uniquePages,
      unique_domains: stats.uniqueDomains,
      searches: stats.searchCount,
      late_night_share_percent: Math.round(stats.lateNightShare * 100),
      top_domains: stats.topDomains.slice(0, 10),
      ai_apps: stats.aiApps.slice(0, 10).map((a) => ({
        name: a.name,
        kind: a.kind,
        visits: a.visits,
        late_night_visits: a.lateNight,
      })),
      conversations: stats.conversations,
      child_messages: stats.childMessages,
      late_night_days: lateDays,
      late_night_by_hour: lateByHour,
      visits_by_category: visitsByCategory,
    },
    summary: report.summary,
    flagged_history: flaggedHistory,
    history_tuple_columns: ["id", "domain", "title_or_search", "visits", "last_seen"],
    history,
    conversations,
    personal_info_shared: report.pii.map((p) => ({
      ref: `c:${p.conversationId}:${p.messageIndex}`,
      type: p.type,
      preview: p.preview,
    })),
    analysis_problems: problems,
  };
}
