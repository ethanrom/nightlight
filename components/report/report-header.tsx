"use client";

import Link from "next/link";
import { BookOpen, Lock, MessagesSquare, Plus, Printer, Sparkles, LayoutDashboard, ShieldAlert, Globe } from "lucide-react";
import { motion } from "motion/react";
import { LogoMark } from "@/components/brand/logo";
import { useReport, type ReportTab } from "@/components/report/report-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtDateRange } from "@/lib/format";
import { AGE_BANDS } from "@/lib/rubric";
import { useReportStore } from "@/lib/report-store";
import { SOURCE_LABEL } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

const TABS: { id: ReportTab; label: string; icon: typeof Globe }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "concerns", label: "Concerns", icon: ShieldAlert },
  { id: "chats", label: "AI Chats", icon: MessagesSquare },
  { id: "browsing", label: "Browsing", icon: Globe },
  { id: "ask", label: "Ask Nightlight", icon: Sparkles },
];

export function SourceChips({ className, max = 3 }: { className?: string; max?: number }) {
  const { report } = useReport();
  const shown = report.sources.slice(0, max);
  const rest = report.sources.slice(max);
  return (
    <ul className={cn("flex flex-wrap items-center gap-1.5", className)} aria-label="Sources">
      {shown.map((s, i) => (
        <li
          key={`${s.kind}-${s.fileName ?? s.label}-${i}`}
          className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-xs text-muted-foreground"
          title={s.fileName ?? SOURCE_LABEL[s.kind]}
        >
          {s.label}
        </li>
      ))}
      {rest.length > 0 && (
        <li
          className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-xs text-muted-foreground"
          title={rest.map((s) => s.label).join(", ")}
        >
          +{rest.length} more
        </li>
      )}
    </ul>
  );
}

export function ReportHeader({ tab, counts }: { tab: ReportTab; counts: Partial<Record<ReportTab, number>> }) {
  const { report, name } = useReport();
  const { newAnalysis } = useReportStore();
  const age = AGE_BANDS.find((a) => a.id === report.ageBand)?.label ?? report.ageBand;

  return (
    <div className="glass print-sticky-off sticky top-0 z-40 border-b border-border/70">
      <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        <div className="flex min-h-16 items-center gap-3 py-2 sm:gap-4">
          <Link href="/" aria-label="Nightlight home" className="shrink-0 rounded-lg outline-offset-4 print:hidden">
            <LogoMark size={30} />
          </Link>
          <span aria-hidden className="hidden h-8 w-px bg-border sm:block print:hidden" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[0.95rem] leading-tight font-semibold tracking-tight sm:text-base">
              {name}’s report
              {report.demo && (
                <span className="ml-2 inline-flex h-5 items-center rounded-full bg-[color-mix(in_oklab,var(--glow)_22%,transparent)] px-2 align-middle text-[0.65rem] font-semibold tracking-wide text-[var(--glow-ink)] uppercase">
                  Demo data
                </span>
              )}
            </h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
              Ages {age.replace(" years", "")} · {fmtDateRange(report.stats.range)}
            </p>
          </div>

          <SourceChips className="hidden 2xl:flex" max={3} />

          <Tooltip>
            <TooltipTrigger
              render={<span tabIndex={0} />}
              className="hidden h-8 items-center gap-1.5 rounded-full bg-sev-normal-soft px-3 text-xs font-medium text-sev-normal-ink md:inline-flex print:hidden"
            >
              <Lock className="size-3.5" />
              Data not stored
            </TooltipTrigger>
            <TooltipContent className="max-w-64 flex-col items-start leading-relaxed">
              This report lives only in this browser tab. It is cleared when you start a new analysis or close the tab.
            </TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-1.5 print:hidden">
            <Button variant="outline" className="hidden h-9 gap-1.5 rounded-full px-3.5 sm:inline-flex" onClick={() => window.print()}>
              <Printer className="size-4" />
              Print / Save PDF
            </Button>
            <Button variant="outline" size="icon" className="size-9 rounded-full sm:hidden" aria-label="Print or save as PDF" onClick={() => window.print()}>
              <Printer className="size-4" />
            </Button>
            <Button className="h-9 gap-1.5 rounded-full px-3.5" onClick={newAnalysis}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">New analysis</span>
              <span className="sm:hidden">New</span>
            </Button>
            <ThemeToggle className="size-9" />
          </div>
        </div>

        <div className="-mx-1 flex items-center justify-between gap-4 print:hidden">
          <TabsList
            variant="line"
            aria-label="Report sections"
            className="no-scrollbar h-11 w-auto max-w-full justify-start gap-0.5 overflow-x-auto rounded-none p-0 group-data-horizontal/tabs:h-11"
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className={cn(
                    "relative h-11 flex-none gap-2 rounded-none border-0 bg-transparent px-3.5 text-sm font-medium text-muted-foreground after:hidden",
                    "hover:text-foreground data-active:bg-transparent data-active:text-foreground data-active:shadow-none dark:data-active:bg-transparent dark:data-active:border-transparent",
                    "group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
                  )}
                >
                  <t.icon className={cn("size-4", t.id === "ask" && active && "text-primary")} />
                  {t.label}
                  {counts[t.id] ? (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-muted px-1.5 text-[0.68rem] font-semibold text-foreground/70 tabular-nums">
                      {counts[t.id]}
                    </span>
                  ) : null}
                  {active && (
                    <motion.span
                      layoutId="report-tab-underline"
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 520, damping: 40 }}
                    />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <Link
            href="/methodology"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden shrink-0 gap-1.5 text-muted-foreground sm:inline-flex")}
          >
            <BookOpen className="size-3.5" />
            Methodology
          </Link>
        </div>
      </div>
    </div>
  );
}
