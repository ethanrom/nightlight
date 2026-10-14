"use client";

import { useMemo } from "react";
import { ArrowRight, CircleCheck } from "lucide-react";
import { CardShell } from "@/components/ask/cards/card-shell";
import { useReport } from "@/components/report/report-context";
import { DimensionBadge, SeverityChip } from "@/components/severity";
import { Button } from "@/components/ui/button";
import type { CardOf } from "@/lib/chat-cards";
import { DIMENSION_BY_ID, severityRank, type Severity } from "@/lib/rubric";
import { SEVERITY_STYLE, collectFindings } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

/** A compact summary of one concern from the report, with a way into the full version on the Concerns tab. */
export function ConcernCard({ card }: { card: CardOf<"concern"> }) {
  const { report, goTo } = useReport();
  const dim = DIMENSION_BY_ID[card.dimension];

  const found = useMemo(() => {
    const concerns = report.summary?.top_concerns ?? [];
    const index = concerns.findIndex((c) => c.dimension === card.dimension);
    if (index >= 0) {
      const c = concerns[index];
      return { index, severity: c.severity as Severity, title: c.title, text: c.what_we_saw };
    }
    // Not one of the top concerns: fall back to the strongest flag for this area.
    const flags = collectFindings(report)
      .filter((f) => f.dimension === card.dimension && !f.normal)
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
    if (flags.length) {
      return { index: -1, severity: flags[0].severity, title: dim.label, text: flags[0].text };
    }
    return null;
  }, [report, card.dimension, dim.label]);

  if (!found) {
    return (
      <CardShell icon={CircleCheck} label="In the report">
        <div className="flex flex-wrap items-center gap-2">
          <DimensionBadge id={card.dimension} full />
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-sev-normal-soft px-2.5 text-xs font-medium text-sev-normal-ink">
            <CircleCheck className="size-3.5" /> Nothing flagged
          </span>
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          No signals for this area were found in what was analysed.
        </p>
      </CardShell>
    );
  }

  const sev = SEVERITY_STYLE[found.severity];
  return (
    <section className="nl-card relative overflow-hidden" aria-label={`Concern: ${found.title}`}>
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", sev.bar)} />
      <div className="p-4 pl-6">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityChip severity={found.severity} />
          <DimensionBadge id={card.dimension} />
        </div>
        <h4 className="text-title mt-3 text-[1.02rem]">{found.title}</h4>
        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{found.text}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 h-7 rounded-full px-3"
          onClick={() => goTo("concerns", found.index >= 0 ? `concern-${found.index}` : undefined)}
        >
          See full concern
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </section>
  );
}
