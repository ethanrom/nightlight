// Shared contracts between parsing (client), the API routes (server) and the dashboard (client).
import type { AgeBand, DietCategory } from "./rubric";
import type {
  ChatAudit,
  DomainCategory,
  HistoryFlag,
  Summary,
} from "./schemas";

export type { AgeBand } from "./rubric";
export type {
  ChatAudit,
  ChatFlag,
  ClassifyHistoryResult,
  AuditChatsResult,
  DomainCategory,
  HistoryFlag,
  Summary,
  TopConcern,
  Trend,
} from "./schemas";

// ---------------------------------------------------------------- parsing (raw, in-browser)

export type SourceKind =
  | "chrome" // Chrome / Edge / Brave / Opera / Vivaldi "History" SQLite
  | "firefox" // places.sqlite
  | "safari" // History.db
  | "takeout" // Google Takeout BrowserHistory.json
  | "csv" // generic export from a history-export extension
  | "chatgpt" // ChatGPT data export conversations.json
  | "claude" // Claude data export conversations.json
  | "transcript"; // pasted chat (Character.AI, Snapchat My AI, Replika, ...)

export interface Visit {
  url: string;
  title: string;
  /** ms since Unix epoch */
  ts: number;
}

export interface ParsedHistory {
  source: SourceKind;
  /** Human label, e.g. "Chrome history", "Firefox history" */
  label: string;
  visits: Visit[];
}

export interface ChatMessage {
  role: "child" | "ai";
  text: string;
  /** ms since Unix epoch, if known */
  ts?: number;
}

export interface Conversation {
  id: string;
  /** "ChatGPT", "Claude", "Character.AI", ... */
  platform: string;
  title: string;
  startedAt?: number;
  messages: ChatMessage[];
}

export interface ParsedChats {
  source: SourceKind;
  label: string;
  conversations: Conversation[];
}

export type ParsedFile =
  | { kind: "history"; fileName: string; data: ParsedHistory }
  | { kind: "chats"; fileName: string; data: ParsedChats };

// ---------------------------------------------------------------- preprocessed (sent to the LLM)

/** One deduped page/search, the unit the history classifier sees. */
export interface HistoryItem {
  id: number;
  domain: string;
  /** Path without query string (except search terms, which are lifted into `search`) */
  path: string;
  title: string;
  /** Search query extracted from google/bing/ddg/youtube/tiktok/... URLs */
  search?: string;
  visits: number;
  firstSeen: number;
  lastSeen: number;
  /** Visits between 00:00 and 04:59 local time */
  lateNight: number;
}

export interface PreparedMessage {
  /** index within the conversation – flags refer to this */
  i: number;
  role: "child" | "ai";
  /** PII-redacted text */
  text: string;
  ts?: number;
}

export interface PreparedConversation {
  id: string;
  platform: string;
  title: string;
  startedAt?: number;
  messages: PreparedMessage[];
  /** true if long messages/conversation were shortened to fit the analysis budget */
  truncated: boolean;
}

export type PiiType = "email" | "phone" | "address" | "school" | "social_handle";

export interface PiiHit {
  type: PiiType;
  conversationId: string;
  messageIndex: number;
  /** masked preview, e.g. "lives on M••• Street" – never the raw value */
  preview: string;
}

export type AiAppKind = "ai_chat" | "ai_companion" | "ai_image";

export interface AiAppUsage {
  domain: string;
  name: string;
  kind: AiAppKind;
  visits: number;
  lateNight: number;
}

export interface LocalStats {
  totalVisits: number;
  uniquePages: number;
  uniqueDomains: number;
  searchCount: number;
  /** ms epoch; null if there is no history */
  range: { start: number; end: number } | null;
  perDay: { date: string /* YYYY-MM-DD local */; visits: number; lateNight: number }[];
  /** [weekday 0=Mon..6=Sun][hour 0..23] visit counts (history + child chat messages) */
  heatmap: number[][];
  /** share of activity between 00:00 and 04:59, 0..1 */
  lateNightShare: number;
  topDomains: { domain: string; visits: number }[];
  aiApps: AiAppUsage[];
  conversations: number;
  childMessages: number;
  /** what was actually sent for analysis vs. what was found – shown in the UI, never hidden */
  analysed: {
    historyItems: number;
    historyTotal: number;
    conversations: number;
    conversationsTotal: number;
  };
}

/** Output of lib/preprocess.ts – everything the pipeline needs before calling the LLM. */
export interface PreparedData {
  sources: ReportSource[];
  historyItems: HistoryItem[];
  conversations: PreparedConversation[];
  pii: PiiHit[];
  stats: LocalStats;
}

// ---------------------------------------------------------------- final report (client state)

export interface ReportSource {
  kind: SourceKind;
  label: string;
  fileName?: string;
  /** visits or conversations found in this source */
  count: number;
}

export interface PipelineError {
  stage: "history" | "chats" | "summary";
  kind: LlmErrorKind;
  message: string;
  /** how many items/conversations this error affected */
  affected?: number;
}

export interface Report {
  version: 1;
  generatedAt: number;
  ageBand: AgeBand;
  /** optional nickname the parent typed, used to personalise copy */
  childName?: string;
  sources: ReportSource[];
  stats: LocalStats;
  historyItems: HistoryItem[];
  historyFlags: HistoryFlag[];
  domainCategories: DomainCategory[];
  conversations: PreparedConversation[];
  chatAudits: ChatAudit[];
  pii: PiiHit[];
  summary: Summary | null;
  errors: PipelineError[];
  /** true when this is the bundled demo report */
  demo?: boolean;
  /** `getTimezoneOffset()` of the browser that generated the report (used to re-anchor the cached demo) */
  tzOffsetMinutes?: number;
}

export type { DietCategory };

// ---------------------------------------------------------------- API contracts

export type LlmErrorKind = "refusal" | "invalid_output" | "truncated" | "api" | "bad_request";

export type ApiResult<T> =
  | { ok: true; result: T }
  | { ok: false; error: { kind: LlmErrorKind; message: string } };

/** POST /api/classify-history  body: { ageBand, items: HistoryItem[] (<=150) } -> ApiResult<ClassifyHistoryResult> */
export interface ClassifyHistoryRequest {
  ageBand: AgeBand;
  items: HistoryItem[];
}

/** POST /api/audit-chats  body: { ageBand, conversations } -> ApiResult<AuditChatsResult> */
export interface AuditChatsRequest {
  ageBand: AgeBand;
  conversations: PreparedConversation[];
}

/** History flag joined with the item it refers to (what the summarizer sees). */
export interface FlaggedHistoryItem extends HistoryFlag {
  domain: string;
  title: string;
  search?: string;
  lastSeen: number;
  visits: number;
  lateNight: number;
}

/** Chat audit joined with its conversation metadata (what the summarizer sees). */
export interface DatedChatAudit extends ChatAudit {
  platform: string;
  title: string;
  startedAt?: number;
}

/** POST /api/summarize -> ApiResult<Summary> */
export interface SummarizeRequest {
  ageBand: AgeBand;
  childName?: string;
  stats: LocalStats;
  flaggedHistory: FlaggedHistoryItem[];
  /** sorted oldest -> newest so the model can see trends */
  audits: DatedChatAudit[];
  pii: PiiHit[];
}

/** POST /api/chat -> text/plain stream of the assistant's answer */
export interface ChatRequest {
  ageBand: AgeBand;
  childName?: string;
  /** compact report built by lib/chat-context.ts on the client */
  context: unknown;
  messages: { role: "user" | "assistant"; content: string }[];
}

// ---------------------------------------------------------------- pipeline progress (UI)

export type PipelineStage = "parsing" | "preparing" | "history" | "chats" | "summary" | "done";

export interface PipelineProgress {
  stage: PipelineStage;
  /** live counters for the "analysing" screen */
  found: { pages: number; searches: number; conversations: number; piiRedacted: number };
  /** batches completed / total per LLM stage */
  history: { done: number; total: number };
  chats: { done: number; total: number };
  message?: string;
}

/** What the upload screen hands to the pipeline. */
export interface PipelineInput {
  files: File[];
  /** pasted transcripts (Character.AI, Snapchat My AI, Replika, ...) */
  transcripts: { text: string; platform: string }[];
  ageBand: AgeBand;
  childName?: string;
}
