"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight, Heart, Sprout } from "lucide-react";
import { useReport } from "@/components/report/report-context";
import { DIMENSION_BY_ID } from "@/lib/rubric";
import { DIMENSION_ICON } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";
import type { Trend } from "@/lib/types";

export function PositivesCard() {
  const { report, name } = useReport();
  const items = report.summary?.positives ?? [];
  return (
    <section
      className="relative flex h-full flex-col overflow-hidden rounded-[var(--radius-2xl)] border border-[color-mix(in_oklab,var(--glow)_38%,var(--border))] bg-[linear-gradient(160deg,color-mix(in_oklab,var(--glow)_14%,var(--card)),var(--card)_62%)] p-6 shadow-soft sm:p-7"
      aria-labelledby="positives-title"
    >
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-[radial-gradient(circle,rgb(246_178_74/0.25),transparent_68%)]" />
      <div className="relative flex flex-1 flex-col">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--glow)_26%,transparent)] text-[var(--glow-ink)]">
            <Sprout className="size-5" />
          </span>
          <div>
            <h3 id="positives-title" className="text-title text-lg">
              What’s going well
            </h3>
            <p className="text-sm text-muted-foreground">
              {name === "Your child" ? "Worth celebrating" : `Things to celebrate about ${name}`}
            </p>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">Nothing specific stood out this time.</p>
        ) : (
          <ul className="mt-5 space-y-3.5">
            {items.map((p) => (
              <li key={p} className="flex gap-3 text-[0.93rem] leading-relaxed text-foreground/90">
                <Heart className="mt-1 size-3.5 shrink-0 fill-[var(--glow)] text-[var(--glow)]" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-auto pt-6 text-sm leading-relaxed text-foreground/75">
          <span className="font-medium text-[var(--glow-ink)]">A small idea: </span>
          name one of these out loud today. Specific praise builds the trust that makes harder conversations easier.
        </p>
      </div>
    </section>
  );
}

const DIRECTION: Record<Trend["direction"], { label: string; icon: typeof ArrowUpRight; chip: string }> = {
  rising: { label: "Rising", icon: ArrowUpRight, chip: "bg-sev-talk-soft text-sev-talk-ink" },
  steady: { label: "Steady", icon: ArrowRight, chip: "bg-muted text-muted-foreground" },
  easing: { label: "Easing", icon: ArrowDownRight, chip: "bg-sev-normal-soft text-sev-normal-ink" },
};

export function TrendsCard() {
  const { report } = useReport();
  const trends = report.summary?.trends ?? [];
  return (
    <section className="nl-card h-full p-6 sm:p-7" aria-labelledby="trends-title">
      <h3 id="trends-title" className="text-title text-lg">
        Trends over time
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">Patterns that only show up across days and weeks.</p>
      {trends.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">Not enough data for trends yet.</p>
      ) : (
        <ul className="mt-5 space-y-3.5">
          {trends.map((t) => {
            const d = DIRECTION[t.direction];
            const Icon = DIMENSION_ICON[t.dimension];
            return (
              <li key={`${t.dimension}-${t.direction}`} className="flex gap-3.5">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{DIMENSION_BY_ID[t.dimension].label}</span>
                    <span className={cn("inline-flex h-5.5 items-center gap-1 rounded-full px-2 text-xs font-medium", d.chip)}>
                      <d.icon className="size-3" />
                      {d.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.evidence}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
