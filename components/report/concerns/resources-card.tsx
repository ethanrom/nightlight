"use client";

import { useMemo, useState } from "react";
import { ExternalLink, HandHeart, Phone } from "lucide-react";
import { useReport } from "@/components/report/report-context";
import { Button } from "@/components/ui/button";
import { resourcesFor, type ResourceRegion } from "@/lib/resources";
import type { DimensionId } from "@/lib/rubric";
import { collectFindings } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

type RegionFilter = "all" | ResourceRegion;
const REGIONS: { id: RegionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "US", label: "US" },
  { id: "UK", label: "UK" },
  { id: "International", label: "International" },
];

export function ResourcesCard() {
  const { report } = useReport();
  const [region, setRegion] = useState<RegionFilter>("all");
  const [showAll, setShowAll] = useState(false);

  const dims = useMemo(() => {
    const set = new Set<DimensionId>();
    for (const c of report.summary?.top_concerns ?? []) set.add(c.dimension);
    for (const f of collectFindings(report)) if (!f.normal) set.add(f.dimension);
    return [...set];
  }, [report]);

  const all = useMemo(() => resourcesFor(dims), [dims]);
  const filtered = all.filter((r) => region === "all" || r.region === region);
  const shown = showAll ? filtered : filtered.slice(0, 6);

  if (all.length === 0) return null;

  return (
    <section className="nl-card p-5 sm:p-7" aria-labelledby="resources-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <HandHeart className="size-5" />
          </span>
          <div>
            <h3 id="resources-title" className="text-title text-xl">
              Support and next steps
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Real organisations that can help, matched to what showed up in this report.
            </p>
          </div>
        </div>
        <div role="group" aria-label="Filter by region" className="flex gap-1 rounded-full bg-muted p-1 print:hidden">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={region === r.id}
              onClick={() => setRegion(r.id)}
              className={cn(
                "h-7 rounded-full px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                region === r.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        {shown.map((r) => (
          <li key={r.id}>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full flex-col rounded-2xl border border-border bg-background/50 p-4 transition-all outline-none hover:border-primary/40 hover:bg-card hover:shadow-soft focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="text-sm font-semibold">{r.name}</span>
                <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </span>
              <span className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{r.description}</span>
              <span className="mt-3 flex flex-wrap items-center gap-2 pt-1">
                {r.phone && (
                  <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-accent px-2.5 text-xs font-medium text-accent-foreground">
                    <Phone className="size-3" />
                    {r.phone}
                  </span>
                )}
                <span className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-xs text-muted-foreground">
                  {r.region}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && (
        <p className="mt-5 text-sm text-muted-foreground">No resources for that region match this report. Try “All”.</p>
      )}
      {filtered.length > 6 && (
        <div className="mt-4 flex justify-center print:hidden">
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer" : `Show all ${filtered.length}`}
          </Button>
        </div>
      )}
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        If you believe a child is in immediate danger, contact your local emergency services. Nightlight is a conversation
        aid and not a substitute for professional advice.
      </p>
    </section>
  );
}
