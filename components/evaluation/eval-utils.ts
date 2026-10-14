// Pure helpers for the /evaluation page: wall-clock date handling, score maths and method metadata.
// Nothing here knows about the numbers in data/eval-results.json.
import {
  Bot,
  Globe,
  Layers,
  MessageSquareText,
  MessageSquareWarning,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import type { EvalSignal, MethodId, Score, SignalSource, SourceLane } from "@/lib/eval-types";
import { SEVERITY_META, severityRank, type Severity } from "@/lib/rubric";

// ------------------------------------------------------------------ dates (wall clock, timezone-free)
// The dataset's timestamps have no timezone ("2026-10-03T01:20:00"). Reading the digits directly keeps the server
// and browser output identical whatever the viewer's timezone, so there is no hydration mismatch.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WALL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Wall-clock time as milliseconds (the digits read as if they were UTC). Only for ordering and positioning. */
export function wallMs(s: string): number {
  const m = WALL_RE.exec(s);
  if (!m) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? 0 : t;
  }
  return Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
}

export function fmtWallDay(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function fmtWallTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getUTCHours();
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? "AM" : "PM"}`;
}

export function fmtWallDayTime(ms: number): string {
  return `${fmtWallDay(ms)}, ${fmtWallTime(ms)}`;
}

export function fmtGenerated(iso: string): string {
  const ms = wallMs(iso);
  const y = new Date(ms).getUTCFullYear();
  return `${fmtWallDay(ms)}, ${y}`;
}

// ------------------------------------------------------------------ numbers

export const scoreText = ([hit, total]: Score) => `${hit}/${total}`;
export const scoreRatio = ([hit, total]: Score) => (total > 0 ? hit / total : 0);

export function fmtCost(usd: number): string {
  if (usd <= 0) return "$0";
  if (usd < 0.01) return "under $0.01";
  return `$${usd.toFixed(2)}`;
}

export function fmtDuration(seconds: number): string {
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))} seconds`;
  const mins = Math.round(seconds / 60);
  return `${mins} minutes`;
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** "three weeks" for 21 days, "10 days" for 10. */
export function spanWords(days: number): string {
  if (days >= 7 && days % 7 === 0) {
    const w = days / 7;
    return `${numberWord(w)} ${w === 1 ? "week" : "weeks"}`;
  }
  return `${days} ${days === 1 ? "day" : "days"}`;
}

// ------------------------------------------------------------------ severity helpers

export function sevLabel(s: Severity): string {
  return SEVERITY_META[s].label;
}

/** True when a method rated a planted signal lower than the answer key says it should be. */
export function ratedBelow(got: Severity | null | undefined, expected: EvalSignal["expected"]): boolean {
  if (!got || expected === "normal") return false;
  return severityRank(got) < severityRank(expected);
}

export function expectedText(expected: EvalSignal["expected"]): string {
  return expected === "normal" ? "left alone" : `${SEVERITY_META[expected].label}`;
}

// ------------------------------------------------------------------ method + lane + source metadata

export interface MethodMeta {
  name: string;
  short: string;
  icon: LucideIcon;
}

export const METHOD_META: Record<MethodId, MethodMeta> = {
  moderation: { name: "OpenAI Moderation API", short: "Moderation", icon: MessageSquareWarning },
  single_chat: { name: "One chat at a time", short: "One chat at a time", icon: MessageSquareText },
  nightlight: { name: "Nightlight", short: "Nightlight", icon: Layers },
};

export const LANES: SourceLane[] = ["browsing", "chatgpt", "characterai"];
export const LANE_META: Record<SourceLane, { label: string; icon: LucideIcon }> = {
  browsing: { label: "Browsing", icon: Globe },
  chatgpt: { label: "ChatGPT", icon: MessagesSquare },
  characterai: { label: "Character.AI", icon: Bot },
};

export const SOURCE_META: Record<SignalSource, { label: string; icon: LucideIcon }> = {
  search: { label: "Search", icon: Globe },
  page: { label: "Page visit", icon: Globe },
  chat: { label: "Chat", icon: MessagesSquare },
};
