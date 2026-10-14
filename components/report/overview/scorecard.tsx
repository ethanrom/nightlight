"use client";

import { useMemo } from "react";
import { useReport } from "@/components/report/report-context";
import { SeverityDot } from "@/components/severity";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SEVERITY_META } from "@/lib/rubric";
import { DIMENSIONS, RISK_GROUPS, type DimensionId } from "@/lib/rubric";
import { GROUP_ORDER, STATUS_META, DIMENSION_ICON, dimensionStates, statusDotClass, type DimensionState } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

function DimensionTile({ id, state }: { id: DimensionId; state: DimensionState }) {
  const dim = DIMENSIONS.find((d) => d.id === id)!;
  const Icon = DIMENSION_ICON[id];
  const meta = STATUS_META[state.status];
  const label =
    state.status === "clear"
      ? "Clear"
      : `${meta.label}${state.max ? `: ${SEVERITY_META[state.max].label.toLowerCase()}` : ""}`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<div tabIndex={0} />}
        aria-label={`${dim.label}: ${label}. ${dim.description}`}
        className={cn(
          "group flex cursor-default items-center gap-3 rounded-xl border border-transparent bg-muted/50 px-3 py-2.5 outline-none transition-colors",
          "hover:border-border hover:bg-card focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
          state.status !== "clear" && "bg-card ring-1 ring-foreground/6",
        )}
      >
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            state.status === "clear" ? "bg-card text-muted-foreground" : "bg-muted text-foreground/80",
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{dim.short}</span>
          <span className="block truncate text-xs text-muted-foreground">{label}</span>
        </span>
        <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", statusDotClass(state.status, state.max))} />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[17rem] flex-col items-start gap-1 py-2 text-left leading-relaxed">
        <span className="font-semibold">{dim.label}</span>
        <span className="opacity-90">{dim.description}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export function Scorecard() {
  const { report } = useReport();
  const states = useMemo(() => dimensionStates(report), [report]);
  const groups = GROUP_ORDER.map((g) => ({
    id: g,
    dims: DIMENSIONS.filter((d) => d.group === g),
  })).filter((g) => g.dims.length);

  return (
    <section className="nl-card p-6 sm:p-7" aria-labelledby="scorecard-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="scorecard-title" className="text-title text-lg">
            The Child Safety Lens
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            14 things a child-development expert would look for, grouped by the 4Cs of online risk.
          </p>
        </div>
        <ul className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <SeverityDot severity="normal" /> Clear
          </li>
          <li className="flex items-center gap-1.5">
            <SeverityDot severity="worth_noticing" /> Watch
          </li>
          <li className="flex items-center gap-1.5">
            <SeverityDot severity="talk_soon" /> Concern
          </li>
          <li className="flex items-center gap-1.5">
            <SeverityDot severity="urgent" /> Urgent
          </li>
        </ul>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
        {groups.map((g) => (
          <div key={g.id} className={cn(g.id === "cross_cutting" && "lg:col-span-2")}>
            <div className="mb-2.5 flex items-baseline gap-2.5">
              <h4 className="text-sm font-semibold tracking-tight">{RISK_GROUPS[g.id].label}</h4>
              <span className="text-xs text-muted-foreground">{RISK_GROUPS[g.id].blurb}</span>
            </div>
            <div className={cn("grid grid-cols-1 gap-2", g.id === "cross_cutting" ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2")}>
              {g.dims.map((d) => (
                <DimensionTile key={d.id} id={d.id} state={states[d.id]} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
