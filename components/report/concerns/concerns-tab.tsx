"use client";

import { Sparkles } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import { ConcernCard } from "@/components/report/concerns/concern-card";
import { OtherNotices } from "@/components/report/concerns/other-notices";
import { ResourcesCard } from "@/components/report/concerns/resources-card";
import { useReport } from "@/components/report/report-context";

export function ConcernsTab() {
  const { report, name } = useReport();
  const concerns = report.summary?.top_concerns ?? [];

  return (
    <div className="space-y-10">
      <section aria-labelledby="concerns-title">
        <div className="mb-5 max-w-2xl">
          <h2 id="concerns-title" className="text-title text-2xl">
            Concerns, with a way in
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Each one comes with why it matters at {name === "Your child" ? "their" : `${name}’s`} age and a warm opening line. None
            of this is a verdict.
          </p>
        </div>
        {concerns.length === 0 ? (
          <div className="nl-card flex flex-col items-center gap-3 p-10 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-sev-normal-soft text-sev-normal-ink">
              <Sparkles className="size-5" />
            </span>
            <p className="text-lg font-medium">Nothing needs a conversation right now.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              We didn’t find anything beyond normal growing up. Check the other tabs for the full picture.
            </p>
          </div>
        ) : (
          <Stagger className="space-y-5" gap={0.08}>
            {concerns.map((c, i) => (
              <StaggerItem key={c.title}>
                <ConcernCard concern={c} index={i} total={concerns.length} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      <OtherNotices />
      <ResourcesCard />
    </div>
  );
}
