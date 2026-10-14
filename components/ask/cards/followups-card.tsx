"use client";

import { motion } from "motion/react";
import { CornerDownRight } from "lucide-react";
import { useAnswer } from "@/components/ask/answer-context";
import type { CardOf } from "@/lib/chat-cards";

/** Suggested next questions under an answer. Only shown for the newest answer, so the thread stays calm. */
export function FollowupsCard({ card }: { card: CardOf<"followups"> }) {
  const { send, busy, isLatest, streaming } = useAnswer();
  if (!isLatest || streaming) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Suggested follow-up questions">
      {card.questions.slice(0, 4).map((q, i) => (
        <motion.button
          key={q}
          type="button"
          disabled={busy}
          onClick={() => send(q)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 * i, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="group inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-left text-sm shadow-soft transition-colors outline-none hover:border-primary/40 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          <span className="min-w-0 text-pretty">{q}</span>
        </motion.button>
      ))}
    </div>
  );
}
