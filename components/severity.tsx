import { CircleCheck, Minus, OctagonAlert, TriangleAlert } from "lucide-react";
import {
  AI_RESPONSE_META,
  DIMENSION_BY_ID,
  SEVERITY_META,
  type AiResponseGrade,
  type DimensionId,
  type Severity,
} from "@/lib/rubric";
import { GRADE_STYLE, SEVERITY_STYLE, DIMENSION_ICON } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

export function SeverityDot({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", SEVERITY_STYLE[severity].dot, className)}
    />
  );
}

export function SeverityChip({
  severity,
  label,
  className,
  showDot = true,
}: {
  severity: Severity;
  label?: string;
  className?: string;
  showDot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        SEVERITY_STYLE[severity].chip,
        className,
      )}
    >
      {showDot && <SeverityDot severity={severity} className="size-1.5" />}
      {label ?? SEVERITY_META[severity].label}
    </span>
  );
}

export function DimensionBadge({
  id,
  className,
  full = false,
}: {
  id: DimensionId;
  className?: string;
  full?: boolean;
}) {
  const d = DIMENSION_BY_ID[id];
  const Icon = DIMENSION_ICON[id];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-medium whitespace-nowrap text-foreground/80",
        className,
      )}
    >
      <Icon className="size-3.5 text-muted-foreground" />
      {full ? d.label : d.short}
    </span>
  );
}

const GRADE_ICON: Record<AiResponseGrade, typeof CircleCheck> = {
  appropriate: CircleCheck,
  could_be_better: TriangleAlert,
  inappropriate_for_a_child: OctagonAlert,
  not_applicable: Minus,
};

export function GradeBadge({ grade, className }: { grade: AiResponseGrade; className?: string }) {
  const Icon = GRADE_ICON[grade];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        GRADE_STYLE[grade].chip,
        className,
      )}
      title={AI_RESPONSE_META[grade].blurb}
    >
      <Icon className="size-3.5" />
      AI: {AI_RESPONSE_META[grade].label}
    </span>
  );
}
