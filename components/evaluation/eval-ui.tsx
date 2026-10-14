// Small presentational atoms shared by the evaluation sections. No hooks, so usable from server and client components.
import { Check, Minus, X } from "lucide-react";
import { AI_RESPONSE_META, type AiResponseGrade } from "@/lib/rubric";
import { GRADE_STYLE } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

/** Thin horizontal meter. Decorative: the figure beside it always carries the value. */
export function Meter({
  value,
  tone = "primary",
  className,
}: {
  value: number;
  tone?: "primary" | "muted";
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div aria-hidden className={cn("overflow-hidden rounded-full bg-foreground/[0.07]", className)}>
      <div
        className={cn("h-full rounded-full", tone === "primary" ? "bg-primary" : "bg-[var(--chart-muted)]")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export type VerdictTone = "good" | "miss" | "bad" | "neutral";

const TONE: Record<VerdictTone, string> = {
  good: "bg-sev-normal-soft text-sev-normal-ink",
  miss: "bg-muted text-muted-foreground",
  bad: "bg-sev-talk-soft text-sev-talk-ink",
  neutral: "bg-muted text-muted-foreground",
};

/** A round tick or cross. Always sits beside words, so meaning never rests on colour alone. */
export function VerdictIcon({
  kind,
  tone,
  className,
}: {
  kind: "check" | "cross" | "dash";
  tone: VerdictTone;
  className?: string;
}) {
  const Icon = kind === "check" ? Check : kind === "cross" ? X : Minus;
  return (
    <span aria-hidden className={cn("grid size-[1.15rem] shrink-0 place-items-center rounded-full", TONE[tone], className)}>
      <Icon className="size-3" strokeWidth={3} />
    </span>
  );
}

/** Plain chip for a verdict that has no severity (e.g. moderation "Flagged"). */
export function PlainChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full bg-muted px-2.5 text-xs font-medium whitespace-nowrap text-foreground/75",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** An AI-reply grade chip, with its own dot so it never relies on colour alone. */
export function GradeChip({ grade, className }: { grade: AiResponseGrade; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        GRADE_STYLE[grade].chip,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", GRADE_STYLE[grade].dot)} />
      {AI_RESPONSE_META[grade].label}
    </span>
  );
}
