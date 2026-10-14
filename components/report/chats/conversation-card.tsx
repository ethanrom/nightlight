"use client";

import { ArrowRight, Moon } from "lucide-react";
import { DimensionBadge, GradeBadge, SeverityDot } from "@/components/severity";
import { Button } from "@/components/ui/button";
import { fmtDateTime, firstLetter, isLateNight } from "@/lib/format";
import { severityRank, type Severity } from "@/lib/rubric";
import { moodMeta } from "@/lib/ui-meta";
import type { ChatAudit, PreparedConversation } from "@/lib/types";
import { RELIANCE_LABEL } from "@/lib/ui-meta";

export function ConversationCard({
  conv,
  audit,
  onOpen,
}: {
  conv: PreparedConversation;
  audit?: ChatAudit;
  onOpen: () => void;
}) {
  const late = conv.startedAt ? isLateNight(conv.startedAt) : false;
  const mood = audit ? moodMeta(audit.child_mood) : null;
  const flags = (audit?.flags ?? []).filter((f) => !f.developmentally_normal && f.severity !== "normal");
  // one entry per dimension, with its highest severity
  const byDim = new Map<string, { dimension: ChatAudit["flags"][number]["dimension"]; severity: Severity }>();
  for (const f of flags) {
    const cur = byDim.get(f.dimension);
    if (!cur || severityRank(f.severity) > severityRank(cur.severity)) byDim.set(f.dimension, { dimension: f.dimension, severity: f.severity });
  }
  const dims = [...byDim.values()].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  const missed = audit?.ai_response.missed_opportunities ?? [];

  return (
    <article className="nl-card nl-card-hover flex h-full flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-accent pr-2.5 pl-1 text-xs font-medium text-accent-foreground">
          <span className="grid size-4.5 place-items-center rounded-full bg-primary/15 text-[0.62rem] font-semibold">{firstLetter(conv.platform)}</span>
          {conv.platform}
        </span>
        {conv.startedAt && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            {late && <Moon className="size-3 text-[var(--glow-ink)]" aria-label="After midnight" />}
            {fmtDateTime(conv.startedAt)}
          </span>
        )}
      </div>

      <h4 className="text-title mt-3.5 text-[1.05rem]">{conv.title}</h4>
      {audit && <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{audit.summary}</p>}

      {audit && audit.topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {audit.topics.map((t) => (
            <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground/75">
              {t}
            </span>
          ))}
        </div>
      )}

      {audit && mood && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="text-base leading-none" aria-hidden>
              {mood.emoji}
            </span>
            <span className="text-muted-foreground">Mood:</span>
            <span className="font-medium">{mood.label}</span>
          </span>
          {audit.reliance_level !== "none" && (
            <span className="text-muted-foreground">
              Reliance: <span className="font-medium text-foreground">{RELIANCE_LABEL[audit.reliance_level]}</span>
            </span>
          )}
        </div>
      )}

      {dims.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {dims.slice(0, 3).map((d) => (
            <span key={d.dimension} className="inline-flex items-center gap-1.5">
              <DimensionBadge id={d.dimension} />
              <SeverityDot severity={d.severity} className="-ml-1" />
            </span>
          ))}
          {dims.length > 3 && <span className="self-center text-xs text-muted-foreground">+{dims.length - 3} more</span>}
        </div>
      )}

      {audit && audit.ai_response.grade !== "not_applicable" && (
        <div className="mt-4 rounded-xl bg-muted/60 p-3.5">
          <GradeBadge grade={audit.ai_response.grade} />
          {missed.length > 0 && (
            <ul className="mt-2.5 space-y-1">
              {missed.slice(0, 2).map((m) => (
                <li key={m} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  {m}
                </li>
              ))}
              {missed.length > 2 && <li className="pl-3 text-xs text-muted-foreground">+{missed.length - 2} more</li>}
            </ul>
          )}
        </div>
      )}

      <div className="mt-auto pt-4">
        <Button variant="outline" size="sm" className="rounded-full print:hidden" onClick={onOpen}>
          View conversation
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </article>
  );
}
