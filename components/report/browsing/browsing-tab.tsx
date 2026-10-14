"use client";

import { Globe } from "lucide-react";
import { ActivityChart } from "@/components/report/browsing/activity-chart";
import { DigitalDiet, TopSites } from "@/components/report/browsing/diet-and-sites";
import { Heatmap } from "@/components/report/browsing/heatmap";
import { PiiCards, SearchTerms } from "@/components/report/browsing/searches-and-pii";
import { useReport } from "@/components/report/report-context";

export function BrowsingTab() {
  const { report } = useReport();
  const hasHistory = report.historyItems.length > 0;

  return (
    <div className="space-y-5">
      {hasHistory ? (
        <>
          <ActivityChart />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-8">
              <Heatmap />
            </div>
            <div className="min-w-0 lg:col-span-4">
              <DigitalDiet />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <TopSites />
            <SearchTerms />
          </div>
        </>
      ) : (
        <div className="nl-card flex flex-col items-center gap-3 p-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <Globe className="size-5" />
          </span>
          <p className="text-lg font-medium">No browsing history in this analysis</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Add a browser history file to see activity over time, when they are online, and what they search for.
          </p>
        </div>
      )}
      <PiiCards />
    </div>
  );
}
