"use client";

import { Fragment, useMemo, useState } from "react";
import { ArrowDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Lightbulb } from "lucide-react";
import { PlainChip, VerdictIcon } from "@/components/evaluation/eval-ui";
import {
  METHOD_META,
  SOURCE_META,
  expectedText,
  ratedBelow,
  scoreText,
  sevLabel,
  wallMs,
} from "@/components/evaluation/eval-utils";
import { SeverityChip } from "@/components/severity";
import { Button } from "@/components/ui/button";
import type { EvalResults, EvalSignal, MethodId } from "@/lib/eval-types";
import { METHOD_IDS } from "@/lib/eval-types";
import { fmtNum } from "@/lib/format";
import { DIMENSIONS, DIMENSION_BY_ID, type Severity } from "@/lib/rubric";
import { DIMENSION_ICON, SEVERITY_STYLE } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

/** Did a Nightlight run get this signal right? Planted signals must be raised; normal ones must be left alone. */
function runCorrect(s: EvalSignal, detected: boolean) {
  return s.expected === "normal" ? !detected : detected;
}

function runVerdictText(s: EvalSignal, run: { detected: boolean; severity?: Severity | null }) {
  if (s.expected === "normal") return run.detected ? "raised" : "left alone";
  if (!run.detected) return "missed";
  return run.severity ? sevLabel(run.severity) : "caught";
}

function RunDots({ s }: { s: EvalSignal }) {
  const runs = s.results.nightlight.runs;
  if (!runs?.length) return null;
  const right = runs.filter((r) => runCorrect(s, r.detected)).length;
  return (
    <span
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={`${right} of ${runs.length} runs got this right`}
      title={runs.map((r, i) => `Run ${i + 1}: ${runVerdictText(s, r)}`).join("\n")}
    >
      {runs.map((r, i) => (
        <span
          key={i}
          className={cn(
            "size-2.5 rounded-full border-[1.5px]",
            runCorrect(s, r.detected) ? "border-primary bg-primary" : "border-muted-foreground/70 bg-transparent",
          )}
        />
      ))}
    </span>
  );
}

function SeverityOrFlag({ severity }: { severity?: Severity | null }) {
  if (severity && severity !== "normal") {
    return <SeverityChip severity={severity} label={SEVERITY_STYLE[severity].short} />;
  }
  return <PlainChip>Flagged</PlainChip>;
}

function MethodCell({ s, method, runDots = true }: { s: EvalSignal; method: MethodId; runDots?: boolean }) {
  const r = s.results[method];
  const normal = s.expected === "normal";
  const showRuns = method === "nightlight" && runDots;

  let body: React.ReactNode;
  if (normal && !r.detected) {
    body = (
      <>
        <VerdictIcon kind="check" tone="good" />
        <span className="text-xs font-medium text-sev-normal-ink">Left alone</span>
      </>
    );
  } else if (normal) {
    body = (
      <>
        <VerdictIcon kind="cross" tone="bad" />
        <span className="text-xs font-medium text-sev-talk-ink">Raised</span>
        {r.severity && r.severity !== "normal" && (
          <SeverityChip severity={r.severity} label={SEVERITY_STYLE[r.severity].short} />
        )}
      </>
    );
  } else if (r.detected) {
    const low = ratedBelow(r.severity, s.expected);
    body = (
      <>
        <VerdictIcon kind="check" tone="good" />
        <SeverityOrFlag severity={r.severity} />
        {low && (
          <span
            className="inline-flex items-center text-muted-foreground"
            title={`Rated lower than the expected ${expectedText(s.expected)}`}
          >
            <ArrowDown className="size-3.5" />
            <span className="sr-only">Rated lower than the expected {expectedText(s.expected)}</span>
          </span>
        )}
      </>
    );
  } else {
    body = (
      <>
        <VerdictIcon kind="cross" tone="miss" />
        <span className="text-xs font-medium text-muted-foreground">Missed</span>
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      {body}
      {showRuns && <RunDots s={s} />}
    </div>
  );
}

function DetailPanel({ s, runs }: { s: EvalSignal; runs: number }) {
  const SourceIcon = SOURCE_META[s.source].icon;
  const dim = DIMENSION_BY_ID[s.dimension];
  const accepted = s.acceptable.map((a) => DIMENSION_BY_ID[a].label);
  return (
    <div className="grid animate-in gap-6 duration-200 fade-in-0 slide-in-from-top-1 lg:grid-cols-[1fr_1.05fr]">
      <div className="min-w-0 space-y-4">
        <div>
          <p className="text-[0.95rem] leading-snug font-medium text-pretty">{s.label}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <SourceIcon className="size-3.5 shrink-0" />
            {s.sourceDetail}
          </p>
        </div>
        <div className="flex gap-3 rounded-xl bg-[color-mix(in_oklab,var(--glow)_10%,transparent)] px-3.5 py-3">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-[var(--glow-ink)]" />
          <p className="text-sm leading-relaxed text-foreground/85">
            <span className="font-semibold">Why it is hard. </span>
            {s.whyHard}
          </p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          <dt className="text-muted-foreground">Should be</dt>
          <dd className="font-medium">
            {s.expected === "normal" ? "Left alone (developmentally normal)" : `${sevLabel(s.expected)} or higher`}
          </dd>
          <dt className="text-muted-foreground">Dimension</dt>
          <dd className="font-medium">
            {dim.label}
            {accepted.length > 0 && (
              <span className="font-normal text-muted-foreground"> (also accepts {accepted.join(", ")})</span>
            )}
          </dd>
        </dl>
      </div>

      <div className="min-w-0">
        <p className="eyebrow">What each method said</p>
        <ul className="mt-3 space-y-3">
          {METHOD_IDS.map((m) => {
            const r = s.results[m];
            const Icon = METHOD_META[m].icon;
            const assigned = r.dimension && r.dimension !== s.dimension ? DIMENSION_BY_ID[r.dimension].label : null;
            return (
              <li
                key={m}
                className={cn("rounded-xl border border-border bg-card px-3.5 py-3", m === "nightlight" && "border-primary/30")}
              >
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-semibold">{METHOD_META[m].short}</span>
                  <span className="ml-auto">
                    <MethodCell s={s} method={m} runDots={false} />
                  </span>
                </div>
                {(r.note || assigned) && (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {r.note && <span className="first-letter:uppercase">{r.note}</span>}
                    {r.note && assigned && ". "}
                    {assigned && <span>Filed under {assigned}.</span>}
                  </p>
                )}
                {m === "nightlight" && r.runs && r.runs.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Verdict in each of ${runs} runs`}>
                    {r.runs.map((run, i) => (
                      <li
                        key={i}
                        className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs text-muted-foreground"
                      >
                        <span className="font-medium text-foreground/70">Run {i + 1}</span>
                        {runVerdictText(s, run)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul aria-label="How to read the matrix" className="flex flex-wrap items-center gap-x-5 gap-y-2.5 text-xs text-muted-foreground">
      <li className="inline-flex items-center gap-2">
        <VerdictIcon kind="check" tone="good" />
        <SeverityChip severity="talk_soon" label="Talk soon" />
        caught, with the severity it gave
      </li>
      <li className="inline-flex items-center gap-2">
        <VerdictIcon kind="cross" tone="miss" />
        missed
      </li>
      <li className="inline-flex items-center gap-2">
        <VerdictIcon kind="check" tone="good" />
        left alone: correct for a normal item
      </li>
      <li className="inline-flex items-center gap-2">
        <VerdictIcon kind="cross" tone="bad" />
        raised: a false alarm on a normal item
      </li>
      <li className="inline-flex items-center gap-2">
        <ArrowDown className="size-3.5" />
        rated below the expected severity
      </li>
      <li className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1" aria-hidden>
          <span className="size-2.5 rounded-full border-[1.5px] border-primary bg-primary" />
          <span className="size-2.5 rounded-full border-[1.5px] border-muted-foreground/70" />
        </span>
        one dot per Nightlight run: right, wrong
      </li>
    </ul>
  );
}

export function DetectionMatrix({ results }: { results: EvalResults }) {
  const { signals, headline, runs } = results;
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const groups = useMemo(() => {
    const by = new Map<string, EvalSignal[]>();
    for (const s of signals) by.set(s.dimension, [...(by.get(s.dimension) ?? []), s]);
    return DIMENSIONS.filter((d) => by.has(d.id)).map((d) => ({
      dim: d,
      items: [...(by.get(d.id) ?? [])].sort((a, b) => wallMs(a.date) - wallMs(b.date)),
    }));
  }, [signals]);

  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOpen = signals.length > 0 && open.size === signals.length;

  const planted = signals.filter((s) => s.expected !== "normal");
  const normals = signals.filter((s) => s.expected === "normal");
  const nlMissed = planted.filter((s) => !s.results.nightlight.detected).length;
  const nlRaised = normals.filter((s) => s.results.nightlight.detected).length;

  return (
    <div className="nl-card overflow-hidden">
      <div className="space-y-4 border-b border-border p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-2xl text-sm leading-relaxed text-foreground/85">
            {nlMissed === 0 && nlRaised === 0 ? (
              <>Nightlight’s combined verdict caught every planted signal and left every normal item alone. </>
            ) : (
              <>
                Nightlight’s combined verdict missed{" "}
                <strong className="font-semibold tabular-nums">{fmtNum(nlMissed)}</strong> of{" "}
                <span className="tabular-nums">{fmtNum(planted.length)}</span> planted signals and raised{" "}
                <strong className="font-semibold tabular-nums">{fmtNum(nlRaised)}</strong> of{" "}
                <span className="tabular-nums">{fmtNum(normals.length)}</span> normal items.{" "}
              </>
            )}
            Select a row to see the evidence, why it is hard, and each method’s note.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full"
            onClick={() => setOpen(allOpen ? new Set() : new Set(signals.map((s) => s.id)))}
          >
            {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
        </div>
        <Legend />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <caption className="sr-only">
            For each signal in the dataset, whether each method caught it, with the severity it gave. Rows can be expanded.
          </caption>
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="w-[38%] px-4 py-3 pl-5 font-medium">
                Signal
              </th>
              {METHOD_IDS.map((m) => {
                const Icon = METHOD_META[m].icon;
                return (
                  <th
                    key={m}
                    scope="col"
                    className={cn("px-3 py-3 align-bottom font-medium", m === "nightlight" && "bg-primary/[0.06]")}
                  >
                    <span className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-foreground">
                      <Icon className="size-3.5 text-muted-foreground" />
                      {METHOD_META[m].short}
                    </span>
                    <span className="mt-0.5 block font-normal tabular-nums">
                      {scoreText(headline.signalsCaught[m])} caught
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {groups.map(({ dim, items }) => {
              const Icon = DIMENSION_ICON[dim.id];
              return (
                <Fragment key={dim.id}>
                  <tr className="border-t border-border bg-muted/50">
                    <th scope="colgroup" colSpan={4} className="px-5 py-2 text-left">
                      <span className="flex items-center gap-2 text-xs font-semibold text-foreground/85">
                        <Icon className="size-3.5 text-muted-foreground" />
                        {dim.label}
                      </span>
                    </th>
                  </tr>
                  {items.map((s) => {
                    const isOpen = open.has(s.id);
                    const SourceIcon = SOURCE_META[s.source].icon;
                    return (
                      <Fragment key={s.id}>
                        <tr
                          className={cn(
                            "cursor-pointer border-t border-border align-top transition-colors",
                            isOpen ? "bg-muted/40" : "hover:bg-muted/30",
                          )}
                          onClick={() => toggle(s.id)}
                        >
                          <th scope="row" className="p-0 font-normal">
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              aria-controls={`signal-${s.id}`}
                              className="flex w-full items-start gap-2 rounded-md px-4 py-3 pl-5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                            >
                              <ChevronRight
                                className={cn(
                                  "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                                  isOpen && "rotate-90",
                                )}
                              />
                              <span className="min-w-0">
                                <span
                                  className={cn(
                                    "block text-sm leading-snug font-medium text-pretty",
                                    !isOpen && "line-clamp-2",
                                  )}
                                >
                                  {s.label}
                                </span>
                                <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <SourceIcon className="size-3 shrink-0" />
                                  {SOURCE_META[s.source].label} · should be {expectedText(s.expected).toLowerCase()}
                                </span>
                              </span>
                            </button>
                          </th>
                          {METHOD_IDS.map((m) => (
                            <td key={m} className={cn("px-3 py-3", m === "nightlight" && "bg-primary/[0.06]")}>
                              <MethodCell s={s} method={m} />
                            </td>
                          ))}
                        </tr>
                        {isOpen && (
                          <tr id={`signal-${s.id}`} className="bg-muted/40">
                            <td colSpan={4} className="px-5 pt-1 pb-6">
                              <DetailPanel s={s} runs={runs} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
            {groups.length === 0 && (
              <tr className="border-t border-border">
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No signals in this results file.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
