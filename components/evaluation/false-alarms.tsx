import { CircleCheck } from "lucide-react";
import { PlainChip } from "@/components/evaluation/eval-ui";
import { METHOD_META } from "@/components/evaluation/eval-utils";
import { FadeUp } from "@/components/motion";
import { SeverityChip, SeverityDot } from "@/components/severity";
import type { EvalFalseAlarm, EvalResults } from "@/lib/eval-types";
import { METHOD_IDS } from "@/lib/eval-types";
import { fmtNum } from "@/lib/format";

function AlarmChip({ severity }: { severity: EvalFalseAlarm["severity"] }) {
  if (severity === "flagged") return <PlainChip>Flagged</PlainChip>;
  return <SeverityChip severity={severity} />;
}

export function FalseAlarms({ results }: { results: EvalResults }) {
  const { falseAlarms, headline } = results;
  const counts = headline.falseAlarms;
  const total = METHOD_IDS.reduce((n, m) => n + counts[m].talkSoonOrUrgent + counts[m].worthNoticing, 0);
  const outOf = counts.nightlight.outOf;

  return (
    <FadeUp inView className="space-y-5">
      {/* the counts, per method */}
      <div className="nl-card overflow-hidden">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Harmless items each method raised as a concern, by severity.</caption>
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground">
              <th scope="col" className="px-5 py-3 font-medium">
                Method
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <SeverityDot severity="talk_soon" /> Talk soon or urgent
                </span>
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <SeverityDot severity="worth_noticing" /> Worth noticing
                </span>
              </th>
              <th scope="col" className="hidden px-3 py-3 font-medium sm:table-cell">
                Harmless items checked
              </th>
            </tr>
          </thead>
          <tbody>
            {METHOD_IDS.map((m) => {
              const Icon = METHOD_META[m].icon;
              return (
                <tr key={m} className="border-t border-border">
                  <th scope="row" className="px-5 py-3 text-left font-normal">
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                      <Icon className="size-4 text-muted-foreground" />
                      {METHOD_META[m].short}
                    </span>
                  </th>
                  <td className="px-3 py-3 text-sm font-semibold tabular-nums">{fmtNum(counts[m].talkSoonOrUrgent)}</td>
                  <td className="px-3 py-3 text-sm font-semibold tabular-nums">{fmtNum(counts[m].worthNoticing)}</td>
                  <td className="hidden px-3 py-3 text-sm text-muted-foreground tabular-nums sm:table-cell">
                    {fmtNum(counts[m].outOf)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* each item, named */}
      {falseAlarms.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2" aria-label="Every item that was raised but should have been left alone">
          {falseAlarms.map((a, i) => {
            const Icon = METHOD_META[a.method].icon;
            return (
              <li key={`${a.method}-${a.item}-${i}`} className="nl-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-medium text-foreground/80">
                    <Icon className="size-3.5 text-muted-foreground" />
                    {METHOD_META[a.method].short}
                  </span>
                  <AlarmChip severity={a.severity} />
                </div>
                <p className="mt-3 text-sm leading-snug font-medium text-pretty">{a.item}</p>
                {a.note && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{a.note}</p>}
              </li>
            );
          })}
        </ul>
      ) : total === 0 ? (
        <div className="nl-card flex items-start gap-3 p-5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sev-normal-soft text-sev-normal-ink">
            <CircleCheck className="size-4" />
          </span>
          <p className="text-sm leading-relaxed text-foreground/85">
            No false alarms. None of the <span className="tabular-nums">{fmtNum(outOf)}</span> harmless items was raised as a
            concern by any method.
          </p>
        </div>
      ) : (
        <div className="nl-card p-5 text-sm leading-relaxed text-muted-foreground">
          The counts above include <span className="tabular-nums">{fmtNum(total)}</span> raised items, but this results file does
          not list them one by one.
        </div>
      )}
    </FadeUp>
  );
}
