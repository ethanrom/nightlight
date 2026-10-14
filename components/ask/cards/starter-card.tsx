"use client";

import { useState } from "react";
import { Check, Copy, Feather, MessageCircleHeart, RefreshCw, Smile, Target, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useAnswer } from "@/components/ask/answer-context";
import { Button } from "@/components/ui/button";
import type { CardOf, StarterTone } from "@/lib/chat-cards";

const TONE: Record<StarterTone, { label: string; icon: LucideIcon }> = {
  gentle: { label: "Gentle", icon: Feather },
  direct: { label: "Direct", icon: Target },
  playful: { label: "Playful", icon: Smile },
};

/** A conversation-starter quote card with Copy and one-tap rephrasing. */
export function StarterCard({ card }: { card: CardOf<"starter"> }) {
  const { send, busy, isLatest } = useAnswer();
  const [copied, setCopied] = useState(false);
  const tone = TONE[card.tone];
  const ToneIcon = tone.icon;

  // An older starter needs to be quoted, otherwise "that conversation starter" is ambiguous.
  const about = isLatest ? "that conversation starter" : `this conversation starter: “${card.text}”`;
  const actions: { label: string; icon: LucideIcon; message: string }[] = [
    { label: "Gentler", icon: Feather, message: `Rephrase ${about} to be gentler.` },
    { label: "More direct", icon: Target, message: `Rephrase ${about} to be more direct.` },
    {
      label: "Another idea",
      icon: RefreshCw,
      message: isLatest ? "Give me another idea for a conversation starter." : `Give me another idea for a conversation starter, different from: “${card.text}”`,
    },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(card.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast.success("Conversation starter copied", {
        description: "Paste it into a message, or keep it in mind for a quiet moment.",
      });
    } catch {
      toast.error("Couldn’t copy. You can select the text instead.");
    }
  }

  return (
    <figure className="relative overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--glow)_40%,var(--border))] bg-[color-mix(in_oklab,var(--glow)_9%,var(--card))] shadow-soft">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-40 rounded-full bg-[radial-gradient(circle,rgb(246_178_74/0.22),transparent_65%)]" />
      <div className="relative p-4 pb-3.5">
        <figcaption className="flex items-center gap-2.5">
          <span className="grid size-6 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--glow)_25%,transparent)] text-[var(--glow-ink)]">
            <MessageCircleHeart className="size-3.5" />
          </span>
          <span className="eyebrow text-[var(--glow-ink)]">A way to start the conversation</span>
          <span className="ml-auto mr-10 inline-flex h-6 items-center gap-1.5 rounded-full bg-card/70 px-2.5 text-xs font-medium text-foreground/75 ring-1 ring-border">
            <ToneIcon className="size-3" />
            {tone.label}
          </span>
        </figcaption>
        <Button
          variant="outline"
          size="icon-sm"
          className="absolute top-3.5 right-3.5 rounded-full bg-card/80"
          aria-label="Copy conversation starter"
          onClick={copy}
        >
          {copied ? <Check className="size-3.5 text-sev-normal-ink" /> : <Copy className="size-3.5" />}
        </Button>
        <blockquote className="mt-3 text-[1.02rem] leading-relaxed font-medium text-pretty text-foreground">
          “{card.text}”
        </blockquote>
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {actions.map((a) => (
            <Button
              key={a.label}
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => send(a.message)}
              className="h-7 rounded-full bg-card/80 px-3"
            >
              <a.icon className="size-3.5" />
              {a.label}
            </Button>
          ))}
        </div>
      </div>
    </figure>
  );
}
