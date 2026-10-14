"use client";

import { BookOpen, ExternalLink, Lightbulb } from "lucide-react";
import { CardShell } from "@/components/ask/cards/card-shell";
import { useReport } from "@/components/report/report-context";
import { SeverityChip } from "@/components/severity";
import type { CardOf } from "@/lib/chat-cards";
import { AGE_BANDS, DIMENSION_BY_ID, RISK_GROUPS, SOURCES } from "@/lib/rubric";
import { DIMENSION_ICON, dimensionStates } from "@/lib/ui-meta";
import { useMemo } from "react";

/** A rubric explainer: what this area is, what is expected at this age, and why general chatbots miss it. */
export function DimensionCard({ card }: { card: CardOf<"dimension"> }) {
  const { report } = useReport();
  const dim = DIMENSION_BY_ID[card.dimension];
  const Icon = DIMENSION_ICON[card.dimension];
  const state = useMemo(() => dimensionStates(report)[card.dimension], [report, card.dimension]);
  const band = AGE_BANDS.find((a) => a.id === report.ageBand)?.label ?? report.ageBand;

  return (
    <CardShell icon={BookOpen} label="What this area means">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h4 className="text-title text-[1.02rem]">{dim.label}</h4>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[11px] text-muted-foreground">
              {RISK_GROUPS[dim.group].label}
            </span>
            {state.max ? (
              <SeverityChip severity={state.max} className="h-5 text-[11px]" />
            ) : (
              <span className="text-[11px] text-muted-foreground">Nothing flagged in this report</span>
            )}
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-foreground/85">{dim.description}</p>

      <div className="mt-3 rounded-xl bg-muted/70 px-3.5 py-3">
        <p className="eyebrow">At {band}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{dim.ageNotes[report.ageBand]}</p>
      </div>

      <p className="mt-2.5 flex gap-2 rounded-xl bg-[color-mix(in_oklab,var(--glow)_10%,var(--card))] px-3.5 py-3 text-xs leading-relaxed text-muted-foreground ring-1 ring-[color-mix(in_oklab,var(--glow)_30%,var(--border))]">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-[var(--glow-ink)]" />
        <span>
          <span className="font-medium text-foreground/85">Why ChatGPT doesn’t flag this: </span>
          {dim.whyMissed}
        </span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="eyebrow">Sources</span>
        {dim.sources.map((id) => (
          <a
            key={id}
            href={SOURCES[id].url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${SOURCES[id].title}, ${SOURCES[id].org} (${SOURCES[id].year})`}
            className="inline-flex items-center gap-1 rounded text-xs text-muted-foreground underline-offset-2 outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {SOURCES[id].org.split(",")[0].split(" – ")[0]} {SOURCES[id].year}
            <ExternalLink className="size-3" />
          </a>
        ))}
      </div>
    </CardShell>
  );
}
