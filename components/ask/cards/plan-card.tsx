"use client";

import { useCallback, useState } from "react";
import { Check, ListChecks, PartyPopper } from "lucide-react";
import { CardShell } from "@/components/ask/cards/card-shell";
import { useReport } from "@/components/report/report-context";
import type { CardOf } from "@/lib/chat-cards";
import { cn } from "@/lib/utils";

const KEY = "nightlight.ask.plan.v1";

function storageKey(generatedAt: number, title: string) {
  return `${KEY}:${generatedAt}:${title}`;
}

function load(key: string): string[] {
  try {
    const raw = window.sessionStorage.getItem(key);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function Ring({ done, total }: { done: number; total: number }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  const full = done === total;
  return (
    <span
      className="relative grid size-8 place-items-center"
      role="img"
      aria-label={`${done} of ${total} steps done`}
    >
      <svg viewBox="0 0 28 28" className="absolute inset-0 -rotate-90" fill="none">
        <circle cx="14" cy="14" r={r} stroke="var(--border)" strokeWidth="3" />
        <circle
          cx="14"
          cy="14"
          r={r}
          stroke={full ? "var(--sev-normal)" : "var(--chart-1)"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (total ? done / total : 0))}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span className="relative text-[10px] font-semibold tabular-nums">{done}/{total}</span>
    </span>
  );
}

/** An interactive checklist. Progress lives in sessionStorage, keyed by the report and the plan's title. */
export function PlanCard({ card }: { card: CardOf<"plan"> }) {
  const { report } = useReport();
  const key = storageKey(report.generatedAt, card.title);
  const [checked, setChecked] = useState<string[]>(() => (typeof window === "undefined" ? [] : load(key)));

  const toggle = useCallback(
    (step: string) => {
      setChecked((prev) => {
        const next = prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step];
        try {
          window.sessionStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* storage blocked: the checklist still works for this page view */
        }
        return next;
      });
    },
    [key],
  );

  const done = card.steps.filter((s) => checked.includes(s)).length;
  const total = card.steps.length;

  return (
    <CardShell icon={ListChecks} label="A simple plan" aside={<Ring done={done} total={total} />}>
      <h4 className="text-title text-[0.98rem]">{card.title}</h4>
      <ol className="mt-3 space-y-1.5">
        {card.steps.map((step, i) => {
          const on = checked.includes(step);
          return (
            <li key={`${i}-${step}`}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(step)}
                className="group flex w-full items-start gap-3 rounded-xl border border-border bg-background/60 p-2.5 text-left transition-colors outline-none hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    "mt-px grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-transparent group-hover:border-primary/60",
                  )}
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span className={cn("text-sm leading-snug text-pretty transition-colors", on && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                  {step}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {done === total && total > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-sev-normal-ink">
          <PartyPopper className="size-3.5" /> All done. That is a lot of care.
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Tick steps off as you go. Your progress stays in this browser tab.</p>
      )}
    </CardShell>
  );
}
