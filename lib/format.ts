// Small, deterministic formatting helpers. A fixed locale keeps server and client output identical.
import type { Report } from "./types";

const LOCALE = "en-US";

const nf = new Intl.NumberFormat(LOCALE);
const nfCompact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });

export function fmtNum(n: number): string {
  return nf.format(Math.round(n));
}

export function fmtCompact(n: number): string {
  return n >= 10_000 ? nfCompact.format(n) : nf.format(Math.round(n));
}

export function fmtPct(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function plural(n: number, one: string, many?: string): string {
  return `${fmtNum(n)} ${n === 1 ? one : (many ?? `${one}s`)}`;
}

const dShort = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric" });
const dLong = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric", year: "numeric" });
const dTime = new Intl.DateTimeFormat(LOCALE, { hour: "numeric", minute: "2-digit" });
const dWeekday = new Intl.DateTimeFormat(LOCALE, { weekday: "short" });
const dDayTime = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function fmtDate(ms: number): string {
  return dShort.format(ms);
}
export function fmtDateLong(ms: number): string {
  return dLong.format(ms);
}
export function fmtTime(ms: number): string {
  return dTime.format(ms);
}
export function fmtWeekday(ms: number): string {
  return dWeekday.format(ms);
}
export function fmtDateTime(ms: number): string {
  return dDayTime.format(ms);
}

export function fmtDateRange(range: { start: number; end: number } | null): string {
  if (!range) return "No browsing history";
  const s = new Date(range.start);
  const e = new Date(range.end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const start = sameYear ? dShort.format(s) : dLong.format(s);
  return `${start} – ${dLong.format(e)}`;
}

/** "2026-10-04" (local) -> ms at local noon, safe for display. */
export function dayKeyToMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12).getTime();
}

export function localDayKey(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Midnight to 04:59 local time, matching LocalStats.lateNight. */
export function isLateNight(ms: number): boolean {
  return new Date(ms).getHours() < 5;
}

export function hourLabel(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

export const WEEKDAYS_MON_FIRST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAYS_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** Child's display name, or a neutral fallback. Never gendered. */
export function childLabel(report: Pick<Report, "childName">): string {
  return report.childName?.trim() || "Your child";
}
export function childPossessive(report: Pick<Report, "childName">): string {
  const n = report.childName?.trim();
  return n ? `${n}${n.endsWith("s") ? "’" : "’s"}` : "your child’s";
}

export function firstLetter(s: string): string {
  const m = s.replace(/^www\./, "").match(/[a-z0-9]/i);
  return (m ? m[0] : "?").toUpperCase();
}

/** Stable small hash for choosing a tone. */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
