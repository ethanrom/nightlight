"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AskNightlight } from "@/components/ask/ask-nightlight";
import { EvidenceProvider } from "@/components/report/evidence";
import { ReportContextProvider, type ReportCtxValue } from "@/components/report/report-context";
import { childLabel } from "@/lib/format";
import { loadCachedDemo } from "@/lib/pipeline";
import type { Report } from "@/lib/types";

/** Loads /samples/demo-report.json (re-anchored to this browser's timezone, exactly like the real demo) and mounts the chat. */
export function AskHarness() {
  const [report, setReport] = useState<Report | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadCachedDemo().then(setReport, () => setFailed(true));
  }, []);

  const ctx = useMemo<ReportCtxValue | null>(
    () =>
      report && {
        report,
        name: childLabel(report),
        // The real report view switches tabs here; the harness only shows where it would go.
        goTo: (tab, anchor) => toast(`Would open the ${tab} tab${anchor ? ` at #${anchor}` : ""}`),
      },
    [report],
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <p className="eyebrow mb-3">Dev harness · Ask Nightlight · demo report</p>
      {failed && <p className="text-sm text-muted-foreground">Couldn’t load /samples/demo-report.json.</p>}
      {ctx && (
        <ReportContextProvider value={ctx}>
          <EvidenceProvider>
            <AskNightlight />
          </EvidenceProvider>
        </ReportContextProvider>
      )}
    </main>
  );
}
