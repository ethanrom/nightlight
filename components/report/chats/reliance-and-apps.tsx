"use client";

import { useMemo } from "react";
import { Bot, HeartHandshake, Moon, Sparkles } from "lucide-react";
import { useReport } from "@/components/report/report-context";
import { fmtNum, firstLetter } from "@/lib/format";
import { AI_RESPONSE_CRITERIA, AI_RESPONSE_META, type AiResponseGrade } from "@/lib/rubric";
import { GRADE_STYLE } from "@/lib/ui-meta";
import type { AiAppKind } from "@/lib/types";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------ reliance meter

type Level = "none" | "some" | "high";

export function RelianceMeter() {
  const { report } = useReport();
  const { counts, score, ordered } = useMemo(() => {
    const convs = new Map(report.conversations.map((c) => [c.id, c]));
    const counts: Record<Level, number> = { none: 0, some: 0, high: 0 };
    const list: { level: Level; t: number }[] = [];
    for (const a of report.chatAudits) {
      counts[a.reliance_level] += 1;
      list.push({ level: a.reliance_level, t: convs.get(a.id)?.startedAt ?? 0 });
    }
    const n = report.chatAudits.length || 1;
    return {
      counts,
      score: (counts.some * 0.5 + counts.high) / n,
      ordered: list.sort((a, b) => a.t - b.t),
    };
  }, [report]);

  const tone = score < 0.2 ? { label: "Low", bar: "bg-sev-normal", track: "bg-sev-normal-soft" }
    : score < 0.5 ? { label: "Moderate", bar: "bg-sev-talk", track: "bg-sev-talk-soft" }
    : { label: "High", bar: "bg-sev-urgent", track: "bg-sev-urgent-soft" };

  return (
    <section className="nl-card p-5 sm:p-6" aria-labelledby="reliance-title">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground">
          <HeartHandshake className="size-4" />
        </span>
        <div>
          <h3 id="reliance-title" className="text-title text-lg">
            Reliance on AI
          </h3>
          <p className="text-xs text-muted-foreground">How much an AI is standing in for people</p>
        </div>
      </div>
      <div className="mt-5 flex items-baseline justify-between">
        <p className="text-3xl font-semibold tracking-tight">{tone.label}</p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {counts.high} high · {counts.some} some · {counts.none} none
        </p>
      </div>
      <div
        className={cn("mt-3 h-2.5 w-full overflow-hidden rounded-full", tone.track)}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(score * 100)}
        aria-label="Reliance on AI"
      >
        <div className={cn("h-full rounded-full transition-all duration-1000", tone.bar)} style={{ width: `${Math.max(4, score * 100)}%` }} />
      </div>
      <p className="eyebrow mt-5">Conversation by conversation</p>
      <div className="mt-2.5 flex flex-wrap gap-1" aria-label="Reliance level per conversation, oldest first">
        {ordered.map((o, i) => (
          <span
            key={i}
            title={`${o.level === "none" ? "No" : o.level === "some" ? "Some" : "High"} reliance`}
            className={cn(
              "size-4 rounded-[4px]",
              o.level === "none" && "bg-muted",
              o.level === "some" && "bg-[color-mix(in_oklab,var(--chart-2)_40%,transparent)]",
              o.level === "high" && "bg-chart-2",
            )}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Each square is a chat, oldest first. Darker means more reliance.</p>
    </section>
  );
}

// ------------------------------------------------------------------ AI apps used

const KIND_LABEL: Record<AiAppKind, string> = {
  ai_chat: "Assistant",
  ai_companion: "Companion",
  ai_image: "Image tool",
};

export function AiAppsCard() {
  const { report } = useReport();
  const apps = report.stats.aiApps;
  const max = Math.max(1, ...apps.map((a) => a.visits));
  const lateTotal = apps.reduce((s, a) => s + a.lateNight, 0);
  const topLate = apps.reduce((best, a) => (a.lateNight > best.lateNight ? a : best), apps[0] ?? { lateNight: 0, name: "", visits: 0 });
  return (
    <section className="nl-card flex h-full flex-col p-5 sm:p-6" aria-labelledby="apps-title">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Bot className="size-4" />
        </span>
        <div>
          <h3 id="apps-title" className="text-title text-lg">
            AI apps used
          </h3>
          <p className="text-xs text-muted-foreground">From browsing history, with visits after midnight</p>
        </div>
      </div>
      {apps.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No AI sites turned up in the browsing history.</p>
      ) : (
        <ul className="my-5 space-y-4">
          {apps.map((a) => (
            <li key={a.domain} className="flex items-center gap-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground">
                {firstLetter(a.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
                    {KIND_LABEL[a.kind]}
                  </span>
                </div>
                <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span
                    className="h-full bg-chart-1"
                    style={{ width: `${((a.visits - a.lateNight) / max) * 100}%` }}
                  />
                  {a.lateNight > 0 && (
                    <span
                      className="ml-0.5 h-full bg-chart-2"
                      style={{ width: `${(a.lateNight / max) * 100}%` }}
                    />
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{fmtNum(a.visits)}</p>
                {a.lateNight > 0 ? (
                  <p className="flex items-center justify-end gap-1 text-xs text-[var(--glow-ink)] tabular-nums">
                    <Moon className="size-3" /> {a.lateNight}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">visits</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {lateTotal > 0 && (
        <p className="mt-auto flex gap-2.5 rounded-xl bg-[color-mix(in_oklab,var(--chart-2)_11%,transparent)] px-3.5 py-3 text-sm leading-relaxed text-foreground/85">
          <Moon className="mt-0.5 size-4 shrink-0 text-[var(--glow-ink)]" />
          <span>
            <span className="font-medium tabular-nums">{fmtNum(lateTotal)}</span> AI visits happened after midnight;{" "}
            <span className="font-medium tabular-nums">{fmtNum(topLate.lateNight)}</span> of them were to{" "}
            <span className="font-medium">{topLate.name}</span>.
          </span>
        </p>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ AI report card + checklist

const GRADES: AiResponseGrade[] = ["appropriate", "could_be_better", "inappropriate_for_a_child", "not_applicable"];

export function AiReportCard() {
  const { report } = useReport();
  const counts = useMemo(() => {
    const c: Record<AiResponseGrade, number> = { appropriate: 0, could_be_better: 0, inappropriate_for_a_child: 0, not_applicable: 0 };
    for (const a of report.chatAudits) c[a.ai_response.grade] += 1;
    return c;
  }, [report]);
  const graded = GRADES.filter((g) => g !== "not_applicable").reduce((s, g) => s + counts[g], 0);

  return (
    <section className="nl-card h-full p-5 sm:p-6" aria-labelledby="ai-grade-title">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Sparkles className="size-4" />
        </span>
        <div>
          <h3 id="ai-grade-title" className="text-title text-lg">
            How the AI itself did
          </h3>
          <p className="text-xs text-muted-foreground">Every reply graded for a child audience</p>
        </div>
      </div>

      {report.chatAudits.length > 0 && (
        <>
          <div className="mt-5 flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Distribution of AI response grades">
            {GRADES.filter((g) => counts[g] > 0).map((g) => (
              <span key={g} className={cn("h-full first:rounded-l-full last:rounded-r-full", GRADE_STYLE[g].dot)} style={{ flex: counts[g] }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {GRADES.filter((g) => counts[g] > 0).map((g) => (
              <li key={g} className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", GRADE_STYLE[g].dot)} />
                <span className="tabular-nums">
                  {counts[g]} {AI_RESPONSE_META[g].label.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
          {graded > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {counts.appropriate} of {graded} assessed replies met the bar below.
            </p>
          )}
        </>
      )}

      <h4 className="mt-6 text-sm font-semibold">What a child-safe AI should do</h4>
      <ul className="mt-3 space-y-2.5">
        {AI_RESPONSE_CRITERIA.map((c) => (
          <li key={c} className="flex gap-2.5 text-sm leading-relaxed text-foreground/85">
            <span className="mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full bg-sev-normal-soft text-sev-normal-ink">
              <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2.5 6.5l2.2 2.2L9.5 3.8" />
              </svg>
            </span>
            {c}
          </li>
        ))}
      </ul>
    </section>
  );
}
