"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy, Footprints, Lightbulb, Quote } from "lucide-react";
import { toast } from "sonner";
import { EvidenceChip } from "@/components/report/evidence";
import { DimensionBadge, SeverityChip } from "@/components/severity";
import { Button } from "@/components/ui/button";
import { DIMENSION_BY_ID } from "@/lib/rubric";
import type { TopConcern } from "@/lib/types";
import { SEVERITY_STYLE } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Conversation starter copied", {
      description: "Paste it into a message, or keep it in mind for a quiet moment.",
    });
    return true;
  } catch {
    toast.error("Couldn’t copy. You can select the text instead.");
    return false;
  }
}

/** Full concern: what we saw, why it matters, a conversation starter with copy, an action and evidence. */
export function ConcernCard({ concern, index, total }: { concern: TopConcern; index: number; total: number }) {
  const sev = SEVERITY_STYLE[concern.severity];
  const dim = DIMENSION_BY_ID[concern.dimension];
  const [copied, setCopied] = useState(false);

  return (
    <article id={`concern-${index}`} className="nl-card relative overflow-hidden scroll-mt-40">
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", sev.bar)} />
      <div className="p-5 pl-7 sm:p-7 sm:pl-9">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityChip severity={concern.severity} />
          <DimensionBadge id={concern.dimension} full />
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {index + 1} of {total}
          </span>
        </div>
        <h3 className="text-title mt-3.5 text-xl sm:text-2xl">{concern.title}</h3>

        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="eyebrow">What we saw</p>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground/85">{concern.what_we_saw}</p>
          </div>
          <div>
            <p className="eyebrow">Why it matters</p>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-foreground/85">{concern.why_it_matters}</p>
            <p className="mt-3 flex gap-2 rounded-xl bg-muted/70 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-[var(--glow-ink)]" />
              <span>
                <span className="font-medium text-foreground/80">Why ChatGPT didn’t flag this: </span>
                {dim.whyMissed}
              </span>
            </p>
          </div>
        </div>

        <figure className="relative mt-6 overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--glow)_40%,var(--border))] bg-[color-mix(in_oklab,var(--glow)_10%,var(--card))] p-5 pr-14">
          <Quote aria-hidden className="absolute top-4 left-4 size-5 text-[var(--glow-ink)] opacity-60" />
          <figcaption className="eyebrow ml-8 text-[var(--glow-ink)]">A way to start the conversation</figcaption>
          <blockquote className="mt-2 ml-8 text-[1.02rem] leading-relaxed font-medium text-pretty text-foreground">
            “{concern.conversation_starter}”
          </blockquote>
          <Button
            variant="outline"
            size="icon-sm"
            className="absolute top-3.5 right-3.5 rounded-full bg-card/80"
            aria-label="Copy conversation starter"
            onClick={async () => {
              if (await copyText(concern.conversation_starter)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }
            }}
          >
            {copied ? <Check className="size-3.5 text-sev-normal-ink" /> : <Copy className="size-3.5" />}
          </Button>
        </figure>

        <div className="mt-5 flex gap-3 rounded-xl bg-accent/50 px-4 py-3.5">
          <Footprints className="mt-0.5 size-4 shrink-0 text-accent-foreground" />
          <div>
            <p className="eyebrow text-accent-foreground/80">Suggested next step</p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{concern.suggested_action}</p>
          </div>
        </div>

        {concern.evidence_refs.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">Evidence</span>
            {concern.evidence_refs.map((r) => (
              <EvidenceChip key={r} refStr={r} />
            ))}
            <span className="text-xs text-muted-foreground">Blurred until you reveal it.</span>
          </div>
        )}
      </div>
    </article>
  );
}

/** Compact version for the Overview tab. */
export function ConcernSummaryCard({
  concern,
  index,
  onOpen,
}: {
  concern: TopConcern;
  index: number;
  onOpen: () => void;
}) {
  const sev = SEVERITY_STYLE[concern.severity];
  return (
    <article className="nl-card nl-card-hover relative flex h-full flex-col overflow-hidden">
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", sev.bar)} />
      <div className="flex flex-1 flex-col p-5 pl-7">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityChip severity={concern.severity} />
          <DimensionBadge id={concern.dimension} />
        </div>
        <h3 className="text-title mt-3 text-[1.08rem]">{concern.title}</h3>
        <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-muted-foreground">{concern.what_we_saw}</p>
        <button
          type="button"
          onClick={onOpen}
          className="group mt-auto flex items-center gap-1.5 pt-4 text-sm font-medium text-primary outline-none hover:underline focus-visible:underline dark:text-[#a8a3ff]"
          aria-label={`Open concern ${index + 1}: ${concern.title}`}
        >
          Conversation starter and next steps
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </article>
  );
}
