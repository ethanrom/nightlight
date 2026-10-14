"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Globe, MessageSquare, Moon, Search, ShieldCheck, type LucideIcon } from "lucide-react";
import { CardShell } from "@/components/ask/cards/card-shell";
import { Blurred, RevealButton } from "@/components/report/blur";
import { resolveChat, resolveHistory, useEvidence } from "@/components/report/evidence";
import { useReport } from "@/components/report/report-context";
import { SeverityDot } from "@/components/severity";
import type { CardOf } from "@/lib/chat-cards";
import { fmtDate, fmtTime, isLateNight } from "@/lib/format";
import { SEVERITY_META, type Severity } from "@/lib/rubric";
import { maxSeverity, parseEvidenceRef } from "@/lib/ui-meta";
import type { Report } from "@/lib/types";

interface Item {
  ref: string;
  icon: LucideIcon;
  text: string;
  /** platform or site, never blurred */
  where: string;
  /** "Search", "Page", or who wrote the message */
  kind: string;
  when?: number;
  severity: Severity | null;
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function resolve(report: Report, ref: string, childName: string): Item | null {
  const parsed = parseEvidenceRef(ref);
  if (parsed?.type === "history") {
    const r = resolveHistory(report, parsed.id);
    if (!r) return null;
    return {
      ref: parsed.raw,
      icon: r.item.search ? Search : Globe,
      text: r.item.search ? `“${clip(r.item.search, 120)}”` : clip(r.item.title || r.item.domain, 120),
      where: r.item.domain,
      kind: r.item.search ? "Search" : "Page",
      when: r.item.lastSeen,
      severity: maxSeverity(r.flags.map((f) => f.severity)),
    };
  }
  if (parsed?.type === "chat") {
    const r = resolveChat(report, parsed.convId, parsed.index);
    const msg = r?.conv.messages[parsed.index];
    if (!r || !msg) return null;
    return {
      ref: parsed.raw,
      icon: MessageSquare,
      text: clip(msg.text, 150),
      where: r.conv.platform,
      kind: msg.role === "child" ? `${childName} wrote` : "AI replied",
      when: msg.ts ?? r.conv.startedAt,
      severity: maxSeverity(r.flags.map((f) => f.severity)),
    };
  }
  return null;
}

const MAX_ITEMS = 4;

/** A compact stack of the pages, searches and messages an answer rests on. Blurred until the parent reveals them. */
export function EvidenceCard({ card }: { card: CardOf<"evidence"> }) {
  const { report, name } = useReport();
  const { openEvidence } = useEvidence();
  const [revealed, setRevealed] = useState(false);
  const who = name === "Your child" ? "Your child" : name;

  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: Item[] = [];
    for (const ref of card.refs) {
      const item = resolve(report, ref, who);
      if (item && !seen.has(item.ref)) {
        seen.add(item.ref);
        out.push(item);
      }
    }
    return out;
  }, [card.refs, report, who]);

  // Refs that don't exist in the report are dropped silently, and so is a card with nothing left.
  if (items.length === 0) return null;
  const shown = items.slice(0, MAX_ITEMS);
  const hidden = items.length - shown.length;

  return (
    <CardShell
      icon={ShieldCheck}
      label="Evidence"
      aside={<RevealButton revealed={revealed} onToggle={() => setRevealed((v) => !v)} />}
    >
      <ul className="space-y-2">
        {shown.map((it) => {
          const Icon = it.icon;
          const late = it.when ? isLateNight(it.when) : false;
          return (
            <li key={it.ref}>
              <button
                type="button"
                onClick={() => openEvidence(it.ref)}
                title="Open this in context"
                className="group flex w-full items-start gap-3 rounded-xl border border-border bg-background/60 p-3 text-left transition-colors outline-none hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <Blurred revealed={revealed} className="block text-sm leading-snug font-medium text-pretty [overflow-wrap:anywhere]">
                    {it.text}
                  </Blurred>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                    <span className="font-medium text-foreground/70">{it.where}</span>
                    <span aria-hidden>·</span>
                    <span>{it.kind}</span>
                    {it.when && (
                      <>
                        <span aria-hidden>·</span>
                        <span>
                          {fmtDate(it.when)}, {fmtTime(it.when)}
                        </span>
                      </>
                    )}
                    {late && (
                      <span className="inline-flex items-center gap-1 text-[var(--glow-ink)]">
                        <Moon className="size-3" /> after midnight
                      </span>
                    )}
                  </span>
                </span>
                <span className="mt-1 flex shrink-0 items-center gap-2">
                  {it.severity && (
                    <span title={SEVERITY_META[it.severity].label}>
                      <SeverityDot severity={it.severity} />
                    </span>
                  )}
                  <ArrowUpRight className="size-4 text-muted-foreground/60 transition-colors group-hover:text-primary" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {card.note ? `${card.note.replace(/[.\s]+$/, "")}. ` : ""}
        {hidden > 0 ? `+${hidden} more in the report. ` : ""}
        Blurred until you choose to reveal it. Tap an item to see it in context.
      </p>
    </CardShell>
  );
}
