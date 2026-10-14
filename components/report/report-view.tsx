"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, CircleAlert, Info, MoonStar, Sparkles } from "lucide-react";
import { ChatsTab } from "@/components/report/chats/chats-tab";
import { BrowsingTab } from "@/components/report/browsing/browsing-tab";
import { AskNightlight } from "@/components/ask/ask-nightlight";
import { ConcernsTab } from "@/components/report/concerns/concerns-tab";
import { EvidenceProvider } from "@/components/report/evidence";
import { OverviewTab } from "@/components/report/overview/overview-tab";
import { ReportHeader, SourceChips } from "@/components/report/report-header";
import { ReportSkeleton } from "@/components/report/report-skeleton";
import { ReportContextProvider, type ReportCtxValue, type ReportTab } from "@/components/report/report-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { childLabel, fmtDateLong, fmtDateRange, fmtNum } from "@/lib/format";
import { useReportStore } from "@/lib/report-store";
import type { Report } from "@/lib/types";
import { cn } from "@/lib/utils";

const IS_DEV = process.env.NODE_ENV !== "production";

/** The page entry: handles hydration, the dev-only ?mock=1 switch and the empty state. */
export function ReportView() {
  const { report, hydrated, loadMock } = useReportStore();
  const params = useSearchParams();
  const wantMock = IS_DEV && params.get("mock") === "1";
  const requested = useRef(false);

  useEffect(() => {
    if (wantMock && !requested.current) {
      requested.current = true;
      void loadMock();
    }
  }, [wantMock, loadMock]);

  if (!hydrated || (wantMock && !report)) return <ReportSkeleton />;
  if (!report) return <EmptyState />;
  return <ReportShell report={report} />;
}

function EmptyState() {
  const { startDemo } = useReportStore();
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-5">
      <div aria-hidden className="pointer-events-none absolute top-1/3 left-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 animate-nl-glow rounded-full bg-[radial-gradient(circle,rgb(246_178_74/0.22),transparent_62%)]" />
      <div className="nl-card relative w-full max-w-md p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <MoonStar className="size-6" />
        </span>
        <h1 className="text-title mt-5 text-2xl">No report yet</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Reports live only in your browser tab and are never stored, so this page is empty after a restart. Start a new
          analysis, or explore a ready-made demo.
        </p>
        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Button className="h-10 rounded-full px-5" onClick={() => void startDemo()}>
            <Sparkles className="size-4" />
            Load the demo
          </Button>
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "h-10 rounded-full px-5")}>
            Back to start
          </Link>
        </div>
      </div>
    </div>
  );
}

function CoverageStrip({ report }: { report: Report }) {
  const [open, setOpen] = useState(false);
  const a = report.stats.analysed;
  const affected = report.errors.reduce((s, e) => s + (e.affected ?? 1), 0);
  return (
    <div className="mx-auto mt-5 flex w-full max-w-[1200px] flex-col gap-2 px-5 sm:px-8 print:mt-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <SourceChips className="2xl:hidden" max={4} />
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Info className="size-3.5" />
          Analysed {fmtNum(a.historyItems)} of {fmtNum(a.historyTotal)} pages
          {a.conversationsTotal > 0 && (
            <>
              {" "}
              and {fmtNum(a.conversations)} of {fmtNum(a.conversationsTotal)} conversations
            </>
          )}
        </span>
        {report.errors.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 rounded-full bg-sev-talk-soft px-2.5 py-1 font-medium text-sev-talk-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50 print:hidden"
          >
            <CircleAlert className="size-3.5" />
            {affected} {affected === 1 ? "item" : "items"} couldn’t be analysed
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      {open && (
        <ul className="nl-card space-y-2 p-4 text-sm print:hidden">
          {report.errors.map((e, i) => (
            <li key={i} className="flex gap-2.5 text-muted-foreground">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-sev-talk-ink" />
              <span>
                {e.message}
                {e.affected ? <span className="tabular-nums"> ({e.affected} affected)</span> : null}
              </span>
            </li>
          ))}
          <li className="pt-1 text-xs text-muted-foreground">
            The rest of the report is unaffected. Nightlight never hides what it couldn’t read.
          </li>
        </ul>
      )}
    </div>
  );
}

function ReportShell({ report }: { report: Report }) {
  const [tab, setTab] = useState<ReportTab>("overview");
  const [visited, setVisited] = useState<Set<ReportTab>>(() => new Set<ReportTab>(["overview"]));
  const name = childLabel(report);

  const select = useCallback((next: ReportTab) => {
    setTab(next);
    setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  }, []);

  const goTo = useCallback(
    (next: ReportTab, anchor?: string) => {
      select(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (anchor) {
        window.setTimeout(() => {
          document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      }
    },
    [select],
  );

  // Print should always be light and clean, whatever theme is on screen.
  useEffect(() => {
    let wasDark = false;
    const before = () => {
      wasDark = document.documentElement.classList.contains("dark");
      document.documentElement.classList.remove("dark");
    };
    const after = () => {
      if (wasDark) document.documentElement.classList.add("dark");
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  const ctx = useMemo<ReportCtxValue>(() => ({ report, name, goTo }), [report, name, goTo]);
  const counts = useMemo(
    () => ({
      concerns: report.summary?.top_concerns.length || undefined,
      chats: report.conversations.length || undefined,
    }),
    [report],
  );

  return (
    <ReportContextProvider value={ctx}>
      <EvidenceProvider>
        <Tabs value={tab} onValueChange={(v) => select(v as ReportTab)} className="min-h-dvh gap-0">
          <ReportHeader tab={tab} counts={counts} />
          <CoverageStrip report={report} />

          <div className="mx-auto hidden w-full max-w-[1200px] px-5 pt-4 sm:px-8 print:block">
            <p className="text-xs text-muted-foreground">
              Nightlight report for {name} · {fmtDateRange(report.stats.range)} · generated {fmtDateLong(report.generatedAt)} · a
              conversation aid, not a diagnosis. Evidence is hidden.
            </p>
          </div>

          <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 pt-6 pb-20 sm:px-8 sm:pt-8">
            <TabsContent value="overview" keepMounted data-print="show" className="animate-in duration-500 fade-in-0 slide-in-from-bottom-2">
              <OverviewTab />
            </TabsContent>
            <TabsContent value="concerns" keepMounted data-print="show" className="animate-in duration-500 fade-in-0 slide-in-from-bottom-2">
              <ConcernsTab />
            </TabsContent>
            <TabsContent value="chats" keepMounted className="animate-in duration-500 fade-in-0 slide-in-from-bottom-2">
              {visited.has("chats") && <ChatsTab />}
            </TabsContent>
            <TabsContent value="browsing" keepMounted className="animate-in duration-500 fade-in-0 slide-in-from-bottom-2">
              {visited.has("browsing") && <BrowsingTab />}
            </TabsContent>
            <TabsContent value="ask" keepMounted className="animate-in duration-500 fade-in-0 slide-in-from-bottom-2">
              {visited.has("ask") && <AskNightlight />}
            </TabsContent>
          </main>
        </Tabs>
      </EvidenceProvider>
    </ReportContextProvider>
  );
}
