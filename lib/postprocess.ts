// Deterministic guard-rails applied to model output in the API routes. The model is asked to follow these
// rules in the prompt; this module makes sure the UI never sees a violation (unknown ids, broken refs,
// contradictory severity flags, an `overall` that disagrees with the findings).
import { severityRank, type OverallLevel, type Severity } from "./rubric";

/** developmentally_normal is true iff severity is "normal". On a contradiction the more cautious reading wins. */
export function reconcileSeverity<T extends { severity: Severity; developmentally_normal: boolean }>(flag: T): T {
  if (flag.severity === "normal") return flag.developmentally_normal ? flag : { ...flag, developmentally_normal: true };
  return flag.developmentally_normal ? { ...flag, developmentally_normal: false } : flag;
}

/** Highest-severity first, stable. */
export function bySeverityDesc<T extends { severity: Severity }>(a: T, b: T): number {
  return severityRank(b.severity) - severityRank(a.severity);
}

/** Maps non-normal severities to the report-level status, following the rule in the summarise prompt. */
export function overallFromSeverities(severities: Severity[]): OverallLevel {
  let max = -1;
  for (const s of severities) max = Math.max(max, severityRank(s));
  if (max >= severityRank("urgent")) return "act_now";
  if (max >= severityRank("talk_soon")) return "talk_soon";
  if (max >= severityRank("worth_noticing")) return "keep_an_eye";
  return "all_clear";
}

/** Normalise text for tolerant verbatim matching (case, whitespace, curly quotes). */
export function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function firstWords(s: string, n: number): string {
  const words = s.trim().split(/\s+/);
  return words.length <= n ? words.join(" ") : words.slice(0, n).join(" ");
}

/**
 * Resolve where a flagged excerpt lives. Returns the message index to use and a verified excerpt, or null if the
 * flag cannot be anchored to any real message (it is then dropped rather than shown with a broken link).
 */
export function anchorExcerpt(
  messages: { i: number; text: string }[],
  preferredIndex: number,
  excerpt: string,
): { index: number; excerpt: string } | null {
  const needle = normText(excerpt);
  const preferred = messages.find((m) => m.i === preferredIndex);
  if (needle && preferred && normText(preferred.text).includes(needle)) return { index: preferred.i, excerpt };
  if (needle) {
    const other = messages.find((m) => normText(m.text).includes(needle));
    if (other) return { index: other.i, excerpt };
  }
  // Excerpt isn't a verbatim substring of anything. Keep the flag if its index is real, but show real text.
  if (preferred) return { index: preferred.i, excerpt: firstWords(preferred.text, 25) };
  return null;
}

/** Keep only refs present in `valid`, de-duplicated, order preserved. */
export function filterRefs(refs: string[], valid: Set<string>): string[] {
  const out: string[] = [];
  for (const raw of refs) {
    const ref = raw.trim().replace(/^\[|\]$/g, "");
    if (valid.has(ref) && !out.includes(ref)) out.push(ref);
  }
  return out;
}
