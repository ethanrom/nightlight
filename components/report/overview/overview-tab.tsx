"use client";

import { ArrowRight } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import { ConcernSummaryCard } from "@/components/report/concerns/concern-card";
import { KpiRow } from "@/components/report/overview/kpi-row";
import { PositivesCard, TrendsCard } from "@/components/report/overview/positives-trends";
import { Scorecard } from "@/components/report/overview/scorecard";
import { StatusHero } from "@/components/report/overview/status-hero";
import { useReport } from "@/components/report/report-context";
import { Button } from "@/components/ui/button";

export function OverviewTab() {
  const { report, goTo } = useReport();
  const concerns = report.summary?.top_concerns ?? [];
  const top = concerns.slice(0, 3);

  if (!report.summary) {
    return (
      <div className="nl-card p-8 text-center text-sm text-muted-foreground">
        The summary couldn’t be written this time, but the charts and flags in the other tabs are still available.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <StatusHero />
      <KpiRow />

      {top.length > 0 && (
        <section aria-labelledby="top-concerns-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 id="top-concerns-title" className="text-title text-xl">
                Most worth a conversation
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The {top.length === 1 ? "one thing" : `${top.length} things`} we’d start with, most important first.
              </p>
            </div>
            {concerns.length > 0 && (
              <Button variant="ghost" size="sm" className="rounded-full print:hidden" onClick={() => goTo("concerns")}>
                All {concerns.length} concerns <ArrowRight className="size-3.5" />
              </Button>
            )}
          </div>
          <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-3" gap={0.08} delay={0.05}>
            {top.map((c, i) => (
              <StaggerItem key={c.title}>
                <ConcernSummaryCard concern={c} index={i} onOpen={() => goTo("concerns", `concern-${i}`)} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PositivesCard />
        <TrendsCard />
      </div>

      <Scorecard />
    </div>
  );
}
