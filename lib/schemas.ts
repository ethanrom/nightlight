// Zod schemas for everything that crosses the LLM boundary (model outputs) and the API boundary
// (request bodies). Model-output schemas are passed to structured outputs, so keep them to
// features the JSON-schema subset supports: objects, arrays, enums, strings, numbers, booleans.
import { z } from "zod";
import {
  AI_RESPONSE_GRADES,
  DIET_CATEGORIES,
  DIMENSION_IDS,
  OVERALL_LEVELS,
  SEVERITIES,
} from "./rubric";

export const DimensionSchema = z.enum(DIMENSION_IDS);
export const SeveritySchema = z.enum(SEVERITIES);
export const AgeBandSchema = z.enum(["6-9", "10-12", "13-15", "16-17"]);

// ---------- /api/classify-history ----------

export const HistoryFlagSchema = z.object({
  id: z.number().int().describe("id of the history item this flag refers to"),
  dimension: DimensionSchema,
  severity: SeveritySchema,
  developmentally_normal: z
    .boolean()
    .describe("true if this is healthy/expected for the child's age, even though notable"),
  reason: z.string().describe("One short sentence (max ~20 words), written for a parent"),
});

export const DomainCategorySchema = z.object({
  domain: z.string(),
  category: z.enum(DIET_CATEGORIES),
});

export const ClassifyHistoryResultSchema = z.object({
  flags: z.array(HistoryFlagSchema),
  domains: z.array(DomainCategorySchema),
});

// ---------- /api/audit-chats ----------

export const ChatFlagSchema = z.object({
  dimension: DimensionSchema,
  severity: SeveritySchema,
  developmentally_normal: z.boolean(),
  message_index: z.number().int().describe("index (i) of the most relevant message"),
  excerpt: z.string().describe("Short verbatim quote (max ~25 words) from that message"),
  explanation: z.string().describe("1–2 sentences for a parent: what this is and why it matters"),
});

export const AiResponseSchema = z.object({
  grade: z.enum(AI_RESPONSE_GRADES),
  missed_opportunities: z
    .array(z.string())
    .describe("Things a child-appropriate AI should have done but did not (short phrases)"),
  notes: z.string().describe("One sentence on how the AI handled this child"),
});

export const ChatAuditSchema = z.object({
  id: z.string().describe("conversation id, copied exactly"),
  summary: z.string().describe("One neutral sentence: what this conversation was about"),
  child_mood: z
    .number()
    .int()
    .describe("Child's apparent mood: -2 very low, -1 low, 0 neutral, 1 positive, 2 very positive"),
  reliance_level: z.enum(["none", "some", "high"]),
  topics: z.array(z.string()).describe("1–3 short topic tags"),
  flags: z.array(ChatFlagSchema),
  ai_response: AiResponseSchema,
});

export const AuditChatsResultSchema = z.object({
  audits: z.array(ChatAuditSchema),
});

// ---------- /api/summarize ----------

export const TrendSchema = z.object({
  dimension: DimensionSchema,
  direction: z.enum(["rising", "steady", "easing"]),
  evidence: z.string().describe("One sentence citing when/what, across conversations or days"),
});

export const TopConcernSchema = z.object({
  title: z.string().describe("Short, calm title (max ~8 words)"),
  dimension: DimensionSchema,
  severity: SeveritySchema,
  what_we_saw: z.string().describe("1–2 sentences, factual, no raw quotes of sensitive content"),
  why_it_matters: z.string().describe("1–2 sentences grounded in child development"),
  conversation_starter: z
    .string()
    .describe("A warm, non-accusatory opening line the parent could actually say"),
  suggested_action: z.string().describe("One practical next step"),
  evidence_refs: z
    .array(z.string())
    .describe("Refs to supporting evidence: 'h:<history id>' or 'c:<conversation id>:<message index>'"),
});

export const SummarySchema = z.object({
  overall: z.enum(OVERALL_LEVELS),
  headline: z.string().describe("One calm sentence summarising the period"),
  summary: z.string().describe("3–4 sentences for the parent"),
  trends: z.array(TrendSchema),
  top_concerns: z.array(TopConcernSchema).describe("Most important first, max 6"),
  positives: z.array(z.string()).describe("2–5 genuinely positive things, specific"),
  ai_usage_insight: z.string().describe("2 sentences on how the child uses AI tools"),
});

// ---------- inferred types ----------

export type HistoryFlag = z.infer<typeof HistoryFlagSchema>;
export type DomainCategory = z.infer<typeof DomainCategorySchema>;
export type ClassifyHistoryResult = z.infer<typeof ClassifyHistoryResultSchema>;
export type ChatFlag = z.infer<typeof ChatFlagSchema>;
export type ChatAudit = z.infer<typeof ChatAuditSchema>;
export type AuditChatsResult = z.infer<typeof AuditChatsResultSchema>;
export type Trend = z.infer<typeof TrendSchema>;
export type TopConcern = z.infer<typeof TopConcernSchema>;
export type Summary = z.infer<typeof SummarySchema>;

// ---------- request bodies (validated in the routes) ----------

export const HistoryItemSchema = z.object({
  id: z.number().int(),
  domain: z.string(),
  path: z.string(),
  title: z.string(),
  search: z.string().optional(),
  visits: z.number(),
  firstSeen: z.number(),
  lastSeen: z.number(),
  lateNight: z.number(),
});

export const PreparedMessageSchema = z.object({
  i: z.number().int(),
  role: z.enum(["child", "ai"]),
  text: z.string(),
  ts: z.number().optional(),
});

export const PreparedConversationSchema = z.object({
  id: z.string(),
  platform: z.string(),
  title: z.string(),
  startedAt: z.number().optional(),
  messages: z.array(PreparedMessageSchema),
  truncated: z.boolean(),
});

export const ClassifyHistoryRequestSchema = z.object({
  ageBand: AgeBandSchema,
  items: z.array(HistoryItemSchema).max(250),
});

export const AuditChatsRequestSchema = z.object({
  ageBand: AgeBandSchema,
  conversations: z.array(PreparedConversationSchema).max(40),
});

// ---------- /api/summarize and /api/chat request bodies (added by the AI layer) ----------

/** Optional client timezone, `new Date().getTimezoneOffset()` (minutes, UTC minus local). Lets the server
 *  show local times to the model so "late night" means the child's late night. */
export const TzOffsetSchema = z.number().int().min(-840).max(840).optional();

export const PiiHitSchema = z.object({
  type: z.enum(["email", "phone", "address", "school", "social_handle"]),
  conversationId: z.string(),
  messageIndex: z.number().int(),
  preview: z.string(),
});

export const FlaggedHistoryItemSchema = HistoryFlagSchema.extend({
  domain: z.string(),
  title: z.string(),
  search: z.string().optional(),
  lastSeen: z.number(),
  visits: z.number(),
  lateNight: z.number(),
});

export const DatedChatAuditSchema = ChatAuditSchema.extend({
  platform: z.string(),
  title: z.string(),
  startedAt: z.number().optional(),
});

export const SummarizeRequestSchema = z.object({
  ageBand: AgeBandSchema,
  childName: z.string().max(60).optional(),
  /** LocalStats; deliberately lenient (only read defensively for the prompt). */
  stats: z.record(z.string(), z.unknown()).default({}),
  flaggedHistory: z.array(FlaggedHistoryItemSchema).max(3000),
  audits: z.array(DatedChatAuditSchema).max(500),
  pii: z.array(PiiHitSchema).max(2000).default([]),
  tzOffsetMinutes: TzOffsetSchema,
});

export const ChatRequestSchema = z.object({
  ageBand: AgeBandSchema,
  childName: z.string().max(60).optional(),
  /** compact report built by lib/chat-context.ts */
  context: z.unknown().refine((v) => v !== undefined && v !== null, "context is required"),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .min(1)
    .max(100),
});

export type SummarizeRequestInput = z.infer<typeof SummarizeRequestSchema>;
export type ChatRequestInput = z.infer<typeof ChatRequestSchema>;
