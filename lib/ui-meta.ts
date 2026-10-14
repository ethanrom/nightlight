// UI-only metadata: icon maps, severity/grade styling, derived dimension status.
// Severity colour is allowed ONLY on chips, accent bars and dots, so every style here is a small token.
import {
  Eye,
  CheckCircle2,
  CloudRain,
  Coins,
  EyeOff,
  Fingerprint,
  Film,
  GraduationCap,
  HeartHandshake,
  ImageOff,
  LifeBuoy,
  Megaphone,
  Scale,
  ShieldAlert,
  TriangleAlert,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";
import {
  DIMENSIONS,
  severityRank,
  type AiResponseGrade,
  type DimensionId,
  type OverallLevel,
  type RiskGroup,
  type Severity,
} from "./rubric";
import type { Report, SourceKind } from "./types";

// ------------------------------------------------------------------ dimensions

const ICONS: Record<string, LucideIcon> = {
  HeartHandshake,
  EyeOff,
  UserRoundX,
  CloudRain,
  LifeBuoy,
  Scale,
  ShieldAlert,
  Fingerprint,
  Film,
  Megaphone,
  GraduationCap,
  TriangleAlert,
  Coins,
  ImageOff,
};

/** Static lookup (not a function call) so the icon can be used as a component without lint noise. */
export const DIMENSION_ICON = Object.fromEntries(
  DIMENSIONS.map((d) => [d.id, ICONS[d.icon] ?? ShieldAlert]),
) as Record<DimensionId, LucideIcon>;

/** Display order for the four Cs plus cross-cutting. */
export const GROUP_ORDER: RiskGroup[] = ["content", "contact", "conduct", "contract", "cross_cutting"];

// ------------------------------------------------------------------ severity

export interface SeverityStyle {
  /** soft chip: background + readable ink */
  chip: string;
  /** solid dot / accent bar */
  dot: string;
  /** left accent bar */
  bar: string;
  /** readable text in the severity ink */
  ink: string;
  /** soft background wash */
  soft: string;
  /** ring (for highlighted messages) */
  ring: string;
  /** raw css var for svg / inline styles */
  cssVar: string;
  short: string;
}

export const SEVERITY_STYLE: Record<Severity, SeverityStyle> = {
  normal: {
    chip: "bg-sev-normal-soft text-sev-normal-ink",
    dot: "bg-sev-normal",
    bar: "bg-sev-normal",
    ink: "text-sev-normal-ink",
    soft: "bg-sev-normal-soft",
    ring: "ring-sev-normal/50",
    cssVar: "var(--sev-normal)",
    short: "Normal",
  },
  worth_noticing: {
    chip: "bg-sev-notice-soft text-sev-notice-ink",
    dot: "bg-sev-notice",
    bar: "bg-sev-notice",
    ink: "text-sev-notice-ink",
    soft: "bg-sev-notice-soft",
    ring: "ring-sev-notice/50",
    cssVar: "var(--sev-notice)",
    short: "Notice",
  },
  talk_soon: {
    chip: "bg-sev-talk-soft text-sev-talk-ink",
    dot: "bg-sev-talk",
    bar: "bg-sev-talk",
    ink: "text-sev-talk-ink",
    soft: "bg-sev-talk-soft",
    ring: "ring-sev-talk/50",
    cssVar: "var(--sev-talk)",
    short: "Talk soon",
  },
  urgent: {
    chip: "bg-sev-urgent-soft text-sev-urgent-ink",
    dot: "bg-sev-urgent",
    bar: "bg-sev-urgent",
    ink: "text-sev-urgent-ink",
    soft: "bg-sev-urgent-soft",
    ring: "ring-sev-urgent/50",
    cssVar: "var(--sev-urgent)",
    short: "Urgent",
  },
};

/** The overall level maps onto the same four tones. */
export const OVERALL_SEVERITY: Record<OverallLevel, Severity> = {
  all_clear: "normal",
  keep_an_eye: "worth_noticing",
  talk_soon: "talk_soon",
  act_now: "urgent",
};

export const OVERALL_ORDER: OverallLevel[] = ["all_clear", "keep_an_eye", "talk_soon", "act_now"];

// ------------------------------------------------------------------ AI response grades

export const GRADE_STYLE: Record<AiResponseGrade, { chip: string; dot: string }> = {
  appropriate: { chip: "bg-sev-normal-soft text-sev-normal-ink", dot: "bg-sev-normal" },
  could_be_better: { chip: "bg-sev-talk-soft text-sev-talk-ink", dot: "bg-sev-talk" },
  inappropriate_for_a_child: { chip: "bg-sev-urgent-soft text-sev-urgent-ink", dot: "bg-sev-urgent" },
  not_applicable: { chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
};

// ------------------------------------------------------------------ mood

export const MOOD_META: Record<number, { label: string; emoji: string; axis: string }> = {
  [-2]: { label: "Very low", emoji: "😞", axis: "Very low" },
  [-1]: { label: "Low", emoji: "🙁", axis: "Low" },
  [0]: { label: "Neutral", emoji: "😐", axis: "Neutral" },
  [1]: { label: "Positive", emoji: "🙂", axis: "Good" },
  [2]: { label: "Very positive", emoji: "😊", axis: "Great" },
};

export function moodMeta(mood: number) {
  return MOOD_META[Math.max(-2, Math.min(2, Math.round(mood)))];
}

// ------------------------------------------------------------------ reliance

export const RELIANCE_LABEL = { none: "None", some: "Some", high: "High" } as const;

// ------------------------------------------------------------------ sources / file kinds

export const SOURCE_LABEL: Record<SourceKind, string> = {
  chrome: "Chrome / Edge history",
  firefox: "Firefox history",
  safari: "Safari history",
  takeout: "Google Takeout",
  csv: "CSV history",
  chatgpt: "ChatGPT export",
  claude: "Claude export",
  transcript: "Pasted transcript",
};

export const TRANSCRIPT_PLATFORMS = ["Character.AI", "Snapchat My AI", "Replika", "Other"] as const;

export interface FileKind {
  label: string;
  tone: "history" | "chat" | "unknown";
}

/** Best-effort, name-based guess shown as a chip on the upload list. The real parser sniffs content. */
export function guessFileKind(name: string): FileKind {
  const n = name.toLowerCase();
  if (n === "places.sqlite") return { label: "Firefox history", tone: "history" };
  if (n === "history.db") return { label: "Safari history", tone: "history" };
  if (n === "history" || n === "history.sqlite") return { label: "Chrome / Edge history", tone: "history" };
  if (n.includes("browserhistory")) return { label: "Google Takeout", tone: "history" };
  if (n === "conversations.json" || n.includes("conversations")) {
    return { label: "ChatGPT / Claude export", tone: "chat" };
  }
  if (n.endsWith(".csv")) return { label: "CSV history", tone: "history" };
  if (n.endsWith(".txt")) return { label: "Chat transcript", tone: "chat" };
  if (n.endsWith(".json")) return { label: "JSON export", tone: "unknown" };
  if (n.endsWith(".sqlite") || n.endsWith(".db")) return { label: "Browser database", tone: "history" };
  return { label: "Will try to read", tone: "unknown" };
}

// ------------------------------------------------------------------ evidence refs

export type EvidenceRef =
  | { type: "history"; id: number; raw: string }
  | { type: "chat"; convId: string; index: number; raw: string };

export function parseEvidenceRef(raw: string): EvidenceRef | null {
  const ref = raw.trim().replace(/^\[|\]$/g, "");
  const h = /^h:(\d+)$/.exec(ref);
  if (h) return { type: "history", id: Number(h[1]), raw: ref };
  const c = /^c:(.+):(\d+)$/.exec(ref);
  if (c) return { type: "chat", convId: c[1], index: Number(c[2]), raw: ref };
  return null;
}

// ------------------------------------------------------------------ derived findings

export interface Finding {
  key: string;
  origin: "history" | "chat";
  dimension: DimensionId;
  severity: Severity;
  normal: boolean;
  /** parent-facing sentence */
  text: string;
  /** evidence ref string, h:<id> or c:<conv>:<i> */
  ref: string;
  /** when it happened (ms), if known */
  when?: number;
  /** label for where it was found, e.g. "Search", "Character.AI" */
  where: string;
}

/** Joins history and chat flags into one list the UI can filter and group. */
export function collectFindings(report: Report): Finding[] {
  const out: Finding[] = [];
  const items = new Map(report.historyItems.map((i) => [i.id, i]));
  for (const f of report.historyFlags) {
    const item = items.get(f.id);
    out.push({
      key: `h:${f.id}:${f.dimension}`,
      origin: "history",
      dimension: f.dimension,
      severity: f.severity,
      normal: f.developmentally_normal || f.severity === "normal",
      text: f.reason,
      ref: `h:${f.id}`,
      when: item?.lastSeen,
      where: item?.search ? "Search" : "Browsing",
    });
  }
  const convs = new Map(report.conversations.map((c) => [c.id, c]));
  for (const a of report.chatAudits) {
    const conv = convs.get(a.id);
    for (const f of a.flags) {
      out.push({
        key: `c:${a.id}:${f.message_index}:${f.dimension}`,
        origin: "chat",
        dimension: f.dimension,
        severity: f.severity,
        normal: f.developmentally_normal || f.severity === "normal",
        text: f.explanation,
        ref: `c:${a.id}:${f.message_index}`,
        when: conv?.messages[f.message_index]?.ts ?? conv?.startedAt,
        where: conv?.platform ?? "Chat",
      });
    }
  }
  return out;
}

export type DimStatus = "clear" | "watch" | "concern";

export interface DimensionState {
  id: DimensionId;
  status: DimStatus;
  /** highest non-normal severity, or null when clear */
  max: Severity | null;
  count: number;
}

/** Status per dimension: max severity across history flags, chat flags and summary concerns. */
export function dimensionStates(report: Report): Record<DimensionId, DimensionState> {
  const findings = collectFindings(report);
  const states = {} as Record<DimensionId, DimensionState>;
  for (const d of DIMENSIONS) {
    states[d.id] = { id: d.id, status: "clear", max: null, count: 0 };
  }
  const bump = (dim: DimensionId, sev: Severity, normal: boolean) => {
    if (normal || sev === "normal") return;
    const s = states[dim];
    s.count += 1;
    if (!s.max || severityRank(sev) > severityRank(s.max)) s.max = sev;
  };
  for (const f of findings) bump(f.dimension, f.severity, f.normal);
  for (const c of report.summary?.top_concerns ?? []) {
    const s = states[c.dimension];
    if (!s.max || severityRank(c.severity) > severityRank(s.max)) s.max = c.severity;
  }
  for (const d of DIMENSIONS) {
    const s = states[d.id];
    if (!s.max) s.status = "clear";
    else if (severityRank(s.max) >= 2) s.status = "concern";
    else s.status = "watch";
  }
  return states;
}

export const STATUS_META: Record<DimStatus, { label: string; icon: LucideIcon }> = {
  clear: { label: "Clear", icon: CheckCircle2 },
  watch: { label: "Watch", icon: Eye },
  concern: { label: "Concern", icon: TriangleAlert },
};

export function statusDotClass(status: DimStatus, max: Severity | null): string {
  if (status === "clear") return "bg-sev-normal";
  if (status === "watch") return "bg-sev-notice";
  return max === "urgent" ? "bg-sev-urgent" : "bg-sev-talk";
}

/** Which refs do the top concerns already cover? Used to split "other things we noticed". */
export function coveredRefs(report: Report): Set<string> {
  const set = new Set<string>();
  for (const c of report.summary?.top_concerns ?? []) {
    for (const r of c.evidence_refs) set.add(r.trim());
  }
  return set;
}

export function maxSeverity(list: Severity[]): Severity | null {
  let best: Severity | null = null;
  for (const s of list) if (!best || severityRank(s) > severityRank(best)) best = s;
  return best;
}
