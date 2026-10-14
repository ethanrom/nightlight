"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Check,
  CloudOff,
  FileText,
  Globe,
  Laptop,
  MessagesSquare,
  RotateCcw,
  ScanEye,
  Sparkles,
} from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { CountUp, EASE } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { DIMENSIONS } from "@/lib/rubric";
import { useReportStore } from "@/lib/report-store";
import type { PipelineProgress, PipelineStage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Step {
  stage: PipelineStage;
  title: string;
  icon: typeof Laptop;
}

const STEPS: Step[] = [
  { stage: "parsing", title: "Parsing in your browser", icon: Laptop },
  { stage: "preparing", title: "Redacting personal details", icon: ScanEye },
  { stage: "history", title: "Analysing pages", icon: Globe },
  { stage: "chats", title: "Auditing AI chats", icon: MessagesSquare },
  { stage: "summary", title: "Writing your report", icon: FileText },
];

const STAGE_INDEX: Record<PipelineStage, number> = {
  parsing: 0,
  preparing: 1,
  history: 2,
  chats: 3,
  summary: 4,
  done: 5,
};

function overallFraction(p: PipelineProgress, done: boolean): number {
  if (done || p.stage === "done") return 1;
  const frac = (d: { done: number; total: number }) => (d.total ? Math.min(1, d.done / d.total) : 0);
  switch (p.stage) {
    case "parsing":
      return 0.04;
    case "preparing":
      return 0.14;
    case "history":
      return 0.2 + 0.4 * frac(p.history);
    case "chats":
      return 0.6 + 0.25 * frac(p.chats);
    case "summary":
      return 0.9;
    default:
      return 1;
  }
}

function stepDetail(step: Step, p: PipelineProgress, state: "done" | "active" | "pending"): string | null {
  switch (step.stage) {
    case "parsing":
      return state === "pending" ? null : `${p.found.pages.toLocaleString("en-US")} pages, ${p.found.conversations} chats found`;
    case "preparing":
      return state === "pending" ? null : `${p.found.piiRedacted} personal details masked`;
    case "history":
      if (state === "pending") return null;
      return p.history.total ? `${Math.min(p.history.done, p.history.total)}/${p.history.total} batches` : state === "done" ? "No pages to analyse" : "Starting…";
    case "chats":
      if (state === "pending") return null;
      return p.chats.total ? `${Math.min(p.chats.done, p.chats.total)}/${p.chats.total} chats` : state === "done" ? "No AI chats to audit" : "Starting…";
    case "summary":
      return state === "active" ? "Pulling it together, kindly" : null;
    default:
      return null;
  }
}

function StepRow({ step, state, detail }: { step: Step; state: "done" | "active" | "pending"; detail: string | null }) {
  const Icon = step.icon;
  return (
    <li className="relative flex items-center gap-3.5">
      <span
        className={cn(
          "relative z-10 grid size-9 shrink-0 place-items-center rounded-full border transition-colors duration-500",
          state === "done" && "border-transparent bg-primary text-primary-foreground",
          state === "active" && "border-primary/40 bg-accent text-accent-foreground",
          state === "pending" && "border-border bg-card text-muted-foreground/60",
        )}
      >
        {state === "done" ? (
          <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.35, ease: EASE }}>
            <Check className="size-4" strokeWidth={2.75} />
          </motion.span>
        ) : (
          <Icon className="size-4" />
        )}
        {state === "active" && (
          <span aria-hidden className="absolute -inset-1 animate-nl-orb rounded-full border border-primary/30" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[0.95rem] leading-tight font-medium transition-colors",
            state === "pending" ? "text-muted-foreground/70" : "text-foreground",
          )}
        >
          {step.title}
        </p>
        <AnimatePresence initial={false}>
          {detail && (
            <motion.p
              key={detail}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-0.5 text-xs text-muted-foreground tabular-nums"
            >
              {detail}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      {state === "active" && (
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 animate-nl-dot rounded-full bg-primary"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </span>
      )}
    </li>
  );
}

function DidYouKnow() {
  const facts = useMemo(
    () => DIMENSIONS.map((d) => ({ title: d.label, text: d.whyMissed })),
    [],
  );
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % facts.length), 5600);
    return () => clearInterval(t);
  }, [facts.length]);
  return (
    <div className="rounded-xl bg-muted/70 p-4">
      <p className="eyebrow mb-2 flex items-center gap-1.5">
        <Sparkles className="size-3 text-[var(--glow-ink)]" />
        Did you know
      </p>
      <div className="min-h-[4.5rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
          >
            <p className="text-sm font-medium">{facts[i].title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Why general chatbots miss it: {facts[i].text.charAt(0).toLowerCase() + facts[i].text.slice(1)}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-3 py-2.5">
      <p className="text-xl leading-none font-semibold tracking-tight">
        <CountUp value={value} duration={0.7} />
      </p>
      <p className="mt-1.5 text-[0.7rem] text-muted-foreground">{label}</p>
    </div>
  );
}

export function AnalysingOverlay() {
  const { analysis, dismissAnalysis, loadCachedDemoNow } = useReportStore();
  const pathname = usePathname();
  const visible =
    analysis.status === "running" ||
    analysis.status === "error" ||
    (analysis.status === "done" && pathname !== "/report");

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && analysis.status === "error") dismissAnalysis();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, analysis.status, dismissAnalysis]);

  const progress = analysis.status === "running" || analysis.status === "done" ? analysis.progress : null;
  const done = analysis.status === "done";
  const idx = done ? 5 : progress ? STAGE_INDEX[progress.stage] : 0;
  const fraction = progress ? overallFraction(progress, done) : 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="analysing"
          role="dialog"
          aria-modal="true"
          aria-labelledby="analysing-title"
          className="fixed inset-0 z-[60] overflow-y-auto bg-background/85 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* soft glow */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-[18%] left-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2 animate-nl-glow rounded-full bg-[radial-gradient(circle,rgb(246_178_74/0.22),transparent_62%)]" />
            <div className="absolute bottom-[-10%] left-[10%] size-[520px] animate-nl-glow rounded-full bg-[radial-gradient(circle,rgb(106_98_234/0.22),transparent_65%)] [animation-delay:-2.5s]" />
          </div>

          <div className="relative mx-auto flex min-h-full w-full max-w-xl items-center px-4 py-10">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="nl-card glass w-full p-6 sm:p-8"
            >
              <div className="flex items-center gap-4">
                <LogoMark size={44} />
                <div>
                  <h2 id="analysing-title" className="text-title text-xl">
                    {analysis.status === "error"
                      ? "That didn’t go to plan"
                      : done
                        ? "Your report is ready"
                        : "Reading the patterns"}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {analysis.status === "error"
                      ? "Your data wasn’t stored or sent anywhere unexpected."
                      : "Parsed here in your browser first. Personal details are masked before anything is analysed."}
                  </p>
                </div>
              </div>

              {analysis.status === "error" ? (
                <div className="mt-7">
                  <div className="flex items-start gap-3 rounded-xl bg-sev-talk-soft p-4">
                    <CloudOff className="mt-0.5 size-5 shrink-0 text-sev-talk-ink" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{analysis.message}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {analysis.capacity
                          ? "To keep this public demo free, live analysis has a daily limit. Nothing is wrong with your file. You can explore the ready-made sample report now, or try again tomorrow."
                          : "This can happen if a file is in an unexpected format, or the analysis service is busy. You can try again, or explore a ready-made demo report instead."}
                      </p>
                      {analysis.detail && (
                        <p className="mt-2 rounded-md bg-background/60 px-2 py-1.5 font-mono text-[0.7rem] break-words text-muted-foreground">
                          {analysis.detail}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <Button size="lg" className="h-10 rounded-full px-4" onClick={() => void loadCachedDemoNow()}>
                      <Sparkles className="size-4" />
                      Load the cached demo instead
                    </Button>
                    <Button variant="outline" size="lg" className="h-10 rounded-full px-4" onClick={dismissAnalysis}>
                      <ArrowLeft className="size-4" />
                      Back
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-accent"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(fraction * 100)}
                    aria-label="Analysis progress"
                  >
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-[var(--glow)]"
                      initial={false}
                      animate={{ width: `${Math.max(3, fraction * 100)}%` }}
                      transition={{ duration: 0.7, ease: EASE }}
                    />
                  </div>

                  <ol className="relative mt-6 space-y-5" aria-live="polite">
                    <span aria-hidden className="absolute top-4 bottom-4 left-[17px] w-px bg-border" />
                    {STEPS.map((s, i) => {
                      const state = i < idx ? "done" : i === idx ? "active" : "pending";
                      return (
                        <StepRow key={s.stage} step={s} state={state} detail={progress ? stepDetail(s, progress, state) : null} />
                      );
                    })}
                  </ol>

                  <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <Counter label="Pages found" value={progress?.found.pages ?? 0} />
                    <Counter label="Searches" value={progress?.found.searches ?? 0} />
                    <Counter label="Conversations" value={progress?.found.conversations ?? 0} />
                    <Counter label="Details redacted" value={progress?.found.piiRedacted ?? 0} />
                  </div>

                  <div className="mt-5">
                    <DidYouKnow />
                  </div>

                  {done && (
                    <p className="mt-4 text-center text-sm text-muted-foreground">
                      <RotateCcw className="mr-1.5 inline size-3.5 animate-spin" />
                      Opening your report…
                    </p>
                  )}
                </>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
