"use client";

import { useMemo } from "react";
import { Salad } from "lucide-react";
import { ChartCard, DataTable } from "@/components/charts/chart-card";
import { useReport } from "@/components/report/report-context";
import { SeverityDot } from "@/components/severity";
import { fmtNum, firstLetter, hashStr } from "@/lib/format";
import { DIET_CATEGORIES, DIET_META, severityRank, type DietCategory, type Severity } from "@/lib/rubric";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------ digital diet

export function DigitalDiet() {
  const { report } = useReport();
  const { rows, total } = useMemo(() => {
    const cat = new Map(report.domainCategories.map((d) => [d.domain, d.category]));
    const totals = Object.fromEntries(DIET_CATEGORIES.map((c) => [c, 0])) as Record<DietCategory, number>;
    for (const it of report.historyItems) totals[cat.get(it.domain) ?? "other"] += it.visits;
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    const rows = DIET_CATEGORIES.map((c) => ({ id: c, label: DIET_META[c].label, visits: totals[c] }))
      .filter((r) => r.visits > 0)
      .sort((a, b) => b.visits - a.visits);
    return { rows, total };
  }, [report]);
  const max = Math.max(1, ...rows.map((r) => r.visits));

  return (
    <ChartCard
      title="Digital diet"
      description="Where the time goes, by kind of site."
      className="h-full"
      table={
        <DataTable
          columns={["Category", "Visits", "Share"]}
          rows={rows.map((r) => [r.label, r.visits, `${Math.round((r.visits / total) * 100)}%`])}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No browsing categories to show.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-[6.2rem_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate text-foreground/85">{r.label}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="block h-full rounded-full bg-chart-1 transition-all duration-1000" style={{ width: `${(r.visits / max) * 100}%` }} />
              </span>
              <span className="w-20 text-right text-xs text-muted-foreground tabular-nums">
                <span className="font-medium text-foreground">{Math.round((r.visits / total) * 100)}%</span> · {fmtNum(r.visits)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}

// ------------------------------------------------------------------ top sites

const TONES = [
  "bg-accent text-accent-foreground",
  "bg-muted text-foreground/70",
  "bg-[color-mix(in_oklab,var(--glow)_20%,transparent)] text-[var(--glow-ink)]",
  "bg-primary/10 text-primary dark:text-[#a8a3ff]",
];

export function TopSites() {
  const { report } = useReport();
  const sites = useMemo(() => {
    const cat = new Map(report.domainCategories.map((d) => [d.domain, d.category]));
    const flagged = new Map<string, Severity>();
    const byId = new Map(report.historyItems.map((i) => [i.id, i]));
    for (const f of report.historyFlags) {
      const item = byId.get(f.id);
      if (!item || f.developmentally_normal || f.severity === "normal") continue;
      const cur = flagged.get(item.domain);
      if (!cur || severityRank(f.severity) > severityRank(cur)) flagged.set(item.domain, f.severity);
    }
    return report.stats.topDomains.slice(0, 8).map((d) => ({
      ...d,
      category: DIET_META[cat.get(d.domain) ?? "other"].label,
      sev: flagged.get(d.domain) ?? null,
    }));
  }, [report]);
  const max = Math.max(1, ...sites.map((s) => s.visits));

  return (
    <ChartCard
      title="Top sites"
      description="Letter avatars only. Nightlight never loads site icons, so no domain leaks."
      className="h-full"
      table={
        <DataTable columns={["Site", "Category", "Visits"]} rows={sites.map((s) => [s.domain, s.category, s.visits])} />
      }
    >
      <ul className="space-y-3.5">
        {sites.map((s) => (
          <li key={s.domain} className="flex items-center gap-3.5">
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl text-sm font-semibold", TONES[hashStr(s.domain) % TONES.length])}>
              {firstLetter(s.domain)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className="truncate text-sm font-medium">{s.domain}</p>
                {s.sev && <SeverityDot severity={s.sev} className="self-center" />}
                <span className="shrink-0 text-xs text-muted-foreground">{s.category}</span>
              </div>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="block h-full rounded-full bg-chart-1/80" style={{ width: `${(s.visits / max) * 100}%` }} />
              </span>
            </div>
            <span className="w-12 text-right text-sm font-semibold tabular-nums">{fmtNum(s.visits)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Salad className="size-3" /> A coloured dot marks a site with something flagged.
      </p>
    </ChartCard>
  );
}
