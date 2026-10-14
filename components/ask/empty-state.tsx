"use client";

import { motion } from "motion/react";
import { ArrowUpRight, Lock } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import type { Suggestion } from "@/components/ask/suggestions";

/** The first thing a parent sees: the Nightlight mark, one line of intro and questions drawn from their own report. */
export function EmptyState({
  who,
  suggestions,
  onPick,
  disabled,
}: {
  who: string;
  suggestions: Suggestion[];
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative flex min-h-full flex-col items-center px-4 py-5 text-center sm:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute top-2 left-1/2 size-[380px] -translate-x-1/2 animate-nl-glow rounded-full bg-[radial-gradient(circle,rgb(246_178_74/0.20),transparent_62%)]"
      />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative mt-auto flex flex-col items-center"
      >
        <LogoMark size={48} />
        <h2 className="text-title mt-4 text-[1.6rem]">Ask Nightlight</h2>
        <p className="mt-1.5 text-[0.95rem] leading-relaxed text-muted-foreground">
          Ask anything about {who}’s report. Every answer comes from what was analysed.
        </p>
      </motion.div>

      <ul className="relative mt-6 grid w-full max-w-2xl gap-2.5 text-left sm:grid-cols-2">
        {suggestions.map((s, i) => (
          <motion.li
            key={s.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(s.text)}
              className="group flex h-full w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-soft transition-all outline-none hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <s.icon className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="eyebrow block text-[10px]">{s.hint}</span>
                <span className="mt-1.5 block text-sm leading-snug font-medium text-pretty">{s.text}</span>
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
            </button>
          </motion.li>
        ))}
      </ul>

      <p className="relative mt-4 mb-auto flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
        <Lock className="size-3" />
        Evidence stays blurred until you choose to reveal it.
      </p>
    </div>
  );
}
