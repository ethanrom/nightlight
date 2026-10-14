"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, Info, TrendingDown, TrendingUp, Minus, X } from "lucide-react";
import { PlainChip, VerdictIcon } from "@/components/evaluation/eval-ui";
import { PatternTimeline, buildTimelineItems } from "@/components/evaluation/pattern-timeline";
import { METHOD_META, fmtWallDay, fmtWallDayTime, sevLabel, wallMs } from "@/components/evaluation/eval-utils";
import { DimensionBadge, SeverityChip } from "@/components/severity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EvalPattern, EvalResults, IsolationResult } from "@/lib/eval-types";
import { METHOD_IDS } from "@/lib/eval-types";
import { fmtNum } from "@/lib/format";
import { SEVERITY_META, severityRank, type Severity } from "@/lib/rubric";
import { DIMENSION_ICON, SEVERITY_STYLE, moodMeta } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------ severity ladder

const LADDER: { key: "clear" | Severity; label: string; dot: Severity }[] = [
  { key: "clear", label: "Nothing raised", dot: "normal" },
  { key: "worth_noticing", label: SEVERITY_META.worth_noticing.label, dot: "worth_noticing" },
  { key: "talk_soon", label: SEVERITY_META.talk_soon.label, dot: "talk_soon" },
  { key: "urgent", label: SEVERITY_META.urgent.label, dot: "urgent" },
];

function ladderKey(sev: Severity | "none" | null | undefined): "clear" | Severity {
  return !sev || sev === "none" || sev === "normal" ? "clear" : sev;
}

function LadderDot({ sev, large }: { sev: Severity | "none" | null | undefined; large?: boolean }) {
  const none = !sev || sev === "none";
  const s: Severity = none ? "normal" : sev;
  return (
    <span
      className={cn(
        "mx-auto block rounded-full",
        large ? "size-[1.15rem] ring-4 ring-primary/20" : "size-3.5",
        none ? "border-2 border-muted-foreground/45 bg-transparent" : SEVERITY_STYLE[s].dot,
      )}
    />
  );
}

function ladderSummary(pattern: EvalPattern): string {
  const alone = pattern.isolation
    .map((i) => i.isolatedSeverity)
    .filter((s): s is Severity => s !== "none" && s !== "normal")
    .sort((a, b) => severityRank(b) - severityRank(a))[0];
  const together = pattern.nightlight.severity;
  if (!together) return "Nightlight did not raise a combined concern for this pattern.";
  if (!alone) {
    return `Taken one at a time, none of these chats raised a concern. Read together, Nightlight rated the pattern ${sevLabel(together).toLowerCase()}.`;
  }
  if (severityRank(together) > severityRank(alone)) {
    return `On their own, the highest any chat scored was ${sevLabel(alone).toLowerCase()}. Read together, Nightlight rated the pattern ${sevLabel(together).toLowerCase()}.`;
  }
  return `The highest any chat scored on its own was ${sevLabel(alone).toLowerCase()}, and read together Nightlight rated the pattern ${sevLabel(together).toLowerCase()}.`;
}

const DIRECTION = {
  rising: { label: "Rising", icon: TrendingUp },
  steady: { label: "Steady", icon: Minus },
  easing: { label: "Easing", icon: TrendingDown },
} as const;

function IsolationRow({ row }: { row: IsolationResult }) {
  const col = ladderKey(row.isolatedSeverity);
  const mood = row.mood != null ? moodMeta(row.mood) : null;
  return (
    <tr className="border-t border-border">
      <th scope="row" className="min-w-0 py-2.5 pr-3 text-left font-normal">
        <span className="block truncate text-sm font-medium" title={row.convTitle}>
          {row.convTitle}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground tabular-nums">
          {row.platform} · {fmtWallDayTime(wallMs(row.startedAt))}
          {mood && (
            <span title={`Mood in this chat: ${mood.label}`}>
              {" "}
              · {mood.emoji} {mood.label}
            </span>
          )}
        </span>
      </th>
      {LADDER.map((c) => (
        <td key={c.key} className="border-l border-border/70 px-1 py-2.5 text-center">
          {c.key === col && (
            <>
              <LadderDot sev={row.isolatedSeverity} />
              <span className="sr-only">{row.isolatedSeverity === "none" ? "Nothing raised" : sevLabel(row.isolatedSeverity)}</span>
            </>
          )}
        </td>
      ))}
    </tr>
  );
}

function AloneVsTogether({ pattern }: { pattern: EvalPattern }) {
  const nl = pattern.nightlight;
  const together = ladderKey(nl.severity);
  const dir = nl.direction ? DIRECTION[nl.direction] : null;
  return (
    <div className="min-w-0">
      <h4 className="text-title text-base">Each chat alone, then read together</h4>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">{ladderSummary(pattern)}</p>
      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">
            The highest severity given to each conversation on its own, and the severity Nightlight gave the pattern when reading them together.
          </caption>
          <thead>
            <tr className="bg-muted/50">
              <th scope="col" className="px-3 py-2 text-xs font-medium text-muted-foreground">
                Conversation on its own
              </th>
              {LADDER.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className="w-[5.75rem] border-l border-border/70 px-1 py-2 text-center align-bottom text-[0.7rem] leading-tight font-medium text-muted-foreground"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr>th:first-child]:pl-3">
            {pattern.isolation.map((row, i) => (
              <IsolationRow key={`${row.convTitle}-${i}`} row={row} />
            ))}
            {pattern.isolation.length === 0 && (
              <tr className="border-t border-border">
                <td colSpan={LADDER.length + 1} className="px-3 py-4 text-sm text-muted-foreground">
                  No single conversation is tied to this pattern.
                </td>
              </tr>
            )}
            <tr className="border-t border-primary/30 bg-primary/[0.07]">
              <th scope="row" className="min-w-0 py-3 pr-3 text-left font-normal">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  Read together
                  {dir && (
                    <span className="inline-flex h-5 items-center gap-1 rounded-full bg-background/80 px-2 text-[0.68rem] font-medium text-foreground/80">
                      <dir.icon className="size-3" />
                      {dir.label}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                  Nightlight · {fmtNum(nl.runsDetected)} of {fmtNum(nl.runs)} runs
                </span>
              </th>
              {LADDER.map((c) => (
                <td key={c.key} className="border-l border-primary/20 px-1 py-3 text-center">
                  {c.key === together && (
                    <>
                      <LadderDot sev={nl.severity} large />
                      <span className="sr-only">{nl.severity ? sevLabel(nl.severity) : "Nothing raised"}</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ method verdicts

function Verdicts({ pattern }: { pattern: EvalPattern }) {
  const nl = pattern.nightlight;
  return (
    <div className="min-w-0">
      <h4 className="text-title text-base">Who spotted it</h4>
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {METHOD_IDS.map((m) => {
          const r = pattern.results[m];
          const Icon = METHOD_META[m].icon;
          const isNl = m === "nightlight";
          return (
            <li
              key={m}
              className={cn(
                "rounded-xl border border-border px-3.5 py-3.5",
                isNl && "border-primary/30 bg-primary/[0.05]",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-semibold">{METHOD_META[m].short}</span>
                <span className="ml-auto inline-flex items-center gap-1.5">
                  {r.detected ? (
                    <>
                      <VerdictIcon kind="check" tone="good" />
                      <span className="text-xs font-semibold text-sev-normal-ink">Detected</span>
                    </>
                  ) : (
                    <>
                      <VerdictIcon kind="cross" tone="miss" />
                      <span className="text-xs font-semibold text-muted-foreground">Missed</span>
                    </>
                  )}
                </span>
              </div>
              {isNl && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {nl.severity ? <SeverityChip severity={nl.severity} /> : <PlainChip>No concern raised</PlainChip>}
                  <span
                    className="inline-flex items-center gap-1"
                    role="img"
                    aria-label={`Detected in ${nl.runsDetected} of ${nl.runs} runs`}
                  >
                    {Array.from({ length: Math.max(0, nl.runs) }, (_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "size-2.5 rounded-full border-[1.5px]",
                          i < nl.runsDetected ? "border-primary bg-primary" : "border-muted-foreground/70",
                        )}
                      />
                    ))}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {fmtNum(nl.runsDetected)} of {fmtNum(nl.runs)} runs
                  </span>
                </div>
              )}
              {r.note && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{r.note}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ one pattern

function PatternPanel({ pattern, signals }: { pattern: EvalPattern; signals: EvalResults["signals"] }) {
  const items = useMemo(() => buildTimelineItems(pattern, signals), [pattern, signals]);
  const [active, setActive] = useState<number | null>(null);
  const span =
    pattern.span.from === pattern.span.to
      ? fmtWallDay(wallMs(pattern.span.from))
      : `${fmtWallDay(wallMs(pattern.span.from))} to ${fmtWallDay(wallMs(pattern.span.to))}`;

  return (
    <div className="animate-in space-y-6 pt-6 duration-300 fade-in-0">
      <div>
        <h3 className="text-title text-xl text-balance sm:text-2xl">{pattern.title}</h3>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">{pattern.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DimensionBadge id={pattern.dimension} full />
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-medium text-foreground/80 tabular-nums">
            <CalendarDays className="size-3.5 text-muted-foreground" />
            {span}
          </span>
          <span className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-xs font-medium text-foreground/80 tabular-nums">
            {fmtNum(pattern.evidence.length)} pieces of evidence
          </span>
        </div>
      </div>

      {/* timeline */}
      <div className="rounded-xl border border-border p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-title text-base">Evidence across browsing and chats</h4>
          <p className="text-xs text-muted-foreground">Numbers show the order. Hover or focus a dot for details.</p>
        </div>
        {items.length > 0 ? (
          <>
            <PatternTimeline pattern={pattern} items={items} active={active} onActive={setActive} />
            <ol className="mt-4 grid gap-x-6 gap-y-1.5 border-t border-border pt-4 sm:grid-cols-2" aria-label="Evidence in time order">
              {items.map((it) => (
                <li
                  key={`${it.signalId}-${it.n}`}
                  onPointerEnter={() => setActive(it.n)}
                  onPointerLeave={() => setActive(null)}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                    active === it.n && "bg-primary/[0.08]",
                  )}
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[0.65rem] font-semibold text-primary-foreground tabular-nums">
                    {it.n}
                  </span>
                  <span className="min-w-0">
                    <span className="block leading-snug text-pretty">{it.label}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">{fmtWallDayTime(it.ms)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">No dated evidence is listed for this pattern.</p>
        )}
      </div>

      {/* alone vs together + verdicts */}
      <AloneVsTogether pattern={pattern} />
      <Verdicts pattern={pattern} />

      <p className="flex gap-2.5 rounded-xl bg-muted/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <span className="font-semibold text-foreground/80">What counts as detected. </span>
          {pattern.rule}
        </span>
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ explorer

export function PatternExplorer({ results }: { results: EvalResults }) {
  const { patterns, signals } = results;
  const [selected, setSelected] = useState<string>(patterns[0]?.id ?? "");
  const current = patterns.find((p) => p.id === selected) ?? patterns[0];

  if (patterns.length === 0) {
    return (
      <div className="nl-card p-6 text-sm text-muted-foreground">No cross-conversation patterns are in this results file.</div>
    );
  }

  return (
    <div className="nl-card p-5 sm:p-6">
      <Tabs value={current.id} onValueChange={(v) => setSelected(String(v))}>
        <TabsList
          aria-label="Patterns"
          activateOnFocus
          className="h-auto w-full flex-wrap justify-start gap-2 rounded-none bg-transparent p-0 group-data-horizontal/tabs:h-auto"
        >
          {patterns.map((p) => {
            const Icon = DIMENSION_ICON[p.dimension];
            const found = p.results.nightlight.detected;
            return (
              <TabsTrigger
                key={p.id}
                value={p.id}
                className={cn(
                  "h-auto flex-none justify-start gap-2 rounded-full border-border bg-card px-3.5 py-2 text-left text-[0.8rem] leading-snug font-medium whitespace-normal text-foreground/80 after:hidden",
                  "hover:border-primary/40 data-active:border-primary data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none data-active:hover:text-primary-foreground",
                  "dark:data-active:border-primary dark:data-active:bg-primary dark:data-active:text-primary-foreground dark:data-active:hover:text-primary-foreground",
                )}
              >
                <Icon className="size-4" />
                <span>{p.title}</span>
                {found ? (
                  <Check className="size-3.5 opacity-80" aria-label="Nightlight detected it" />
                ) : (
                  <X className="size-3.5 opacity-80" aria-label="Nightlight missed it" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {patterns.map((p) => (
          <TabsContent key={p.id} value={p.id} className="text-sm">
            <PatternPanel pattern={p} signals={signals} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
