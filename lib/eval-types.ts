// Shape of data/eval-results.json, written by scripts/eval.ts and rendered by /evaluation.
// The evaluation runs Nightlight and two baselines over the labelled synthetic dataset (eval/answer-key.ts).
import type { AgeBand, AiResponseGrade, DimensionId, Severity } from "./rubric";

/**
 * moderation  - OpenAI's Moderation API on every history title/search and every child message
 *               ("what a chatbot's own moderation sees").
 * single_chat - Nightlight's rubric on each conversation on its own, with no cross-conversation summary.
 * nightlight  - the full pipeline: history + chats + cross-conversation summary.
 */
export type MethodId = "moderation" | "single_chat" | "nightlight";
export const METHOD_IDS: MethodId[] = ["moderation", "single_chat", "nightlight"];

/** [hit, total] */
export type Score = [number, number];

export interface MethodResult {
  detected: boolean;
  /** severity the method assigned (moderation has none: it's flagged or not) */
  severity?: Severity | null;
  /** dimension the method assigned, if any */
  dimension?: DimensionId | null;
  /** short explanation shown on hover/expand, e.g. "flagged: self-harm" or "not flagged" */
  note?: string;
  /** nightlight only: one entry per run */
  runs?: { detected: boolean; severity?: Severity | null }[];
}

export type SignalSource = "search" | "page" | "chat";
/** visual lane in the pattern timeline */
export type SourceLane = "browsing" | "chatgpt" | "characterai";

export interface EvalSignal {
  /** stable id, e.g. "h-lose-5kg", "c-giftcard" */
  id: string;
  /** what it is, e.g. "Search: “how to lose 5kg in 2 weeks”" (synthetic data, safe to show) */
  label: string;
  source: SignalSource;
  lane: SourceLane;
  /** e.g. "Google search · Sep 29, 7:10 PM" or "ChatGPT · “Weight loss plan for dance”" */
  sourceDetail: string;
  /** ISO timestamp of the item */
  date: string;
  dimension: DimensionId;
  /** other dimensions that also count as a correct detection */
  acceptable: DimensionId[];
  /** minimum severity a correct detection should reach, or "normal" = should NOT be raised as a concern */
  expected: Severity | "normal";
  /** why general-purpose moderation tends to miss it */
  whyHard: string;
  results: Record<MethodId, MethodResult>;
}

export interface PatternEvidence {
  signalId: string;
  date: string;
  lane: SourceLane;
  label: string;
}

export interface IsolationResult {
  convTitle: string;
  platform: string;
  startedAt: string;
  /** highest severity the rubric gave this conversation when audited on its own */
  isolatedSeverity: Severity | "none";
  /** that conversation's child mood (-2..2) when audited on its own, if known */
  mood?: number | null;
}

export interface EvalPattern {
  /** "p1-mood-drift", ... */
  id: string;
  title: string;
  description: string;
  dimension: DimensionId;
  span: { from: string; to: string };
  evidence: PatternEvidence[];
  /** what a correct detection looks like, in words (shown on the page) */
  rule: string;
  results: Record<MethodId, { detected: boolean; note: string }>;
  /** each contributing conversation's severity when audited alone (single_chat view) */
  isolation: IsolationResult[];
  nightlight: {
    severity: Severity | null;
    direction: "rising" | "steady" | "easing" | null;
    runsDetected: number;
    runs: number;
  };
}

export interface EvalAiGrade {
  convTitle: string;
  platform: string;
  /** any of these counts as correct */
  expected: AiResponseGrade[];
  /** nightlight's grade in each run */
  got: AiResponseGrade[];
  why: string;
}

export interface EvalFalseAlarm {
  method: MethodId;
  item: string;
  severity: Severity | "flagged";
  note?: string;
}

export interface EvalResults {
  /** true while this file is the placeholder written before the first real run */
  placeholder?: boolean;
  generatedAt: string;
  runs: number;
  models: { fast: string; smart: string; moderation: string };
  dataset: {
    child: string;
    ageBand: AgeBand;
    days: number;
    visits: number;
    uniquePages: number;
    conversations: number;
    plantedSignals: number;
    benignItems: number;
    benignConversations: number;
  };
  headline: {
    signalsCaught: Record<MethodId, Score>;
    /** detected AND at/above the expected severity */
    severityCorrect: Record<MethodId, Score>;
    patternsFound: Record<MethodId, Score>;
    normalHandled: Record<MethodId, Score>;
    falseAlarms: Record<MethodId, { talkSoonOrUrgent: number; worthNoticing: number; outOf: number }>;
    /** share of signal/pattern verdicts identical across all nightlight runs, 0..1 */
    consistency: number;
    aiGradeAccuracy: Score;
    costUsdPerRun: number;
    secondsPerRun: number;
  };
  signals: EvalSignal[];
  patterns: EvalPattern[];
  aiGrades: EvalAiGrade[];
  falseAlarms: EvalFalseAlarm[];
  limitations: string[];
}
