"use client";

import { useMemo, useState } from "react";
import { Moon } from "lucide-react";
import { ChartCard, DataTable } from "@/components/charts/chart-card";
import { useReport } from "@/components/report/report-context";
import { WEEKDAYS_LONG, WEEKDAYS_MON_FIRST, fmtNum, hourLabel } from "@/lib/format";

const BUCKETS: { label: string; from: number; to: number }[] = [
  { label: "Overnight 12–5am", from: 0, to: 5 },
  { label: "Morning 5am–12pm", from: 5, to: 12 },
  { label: "Afternoon 12–5pm", from: 12, to: 17 },
  { label: "Evening 5–9pm", from: 17, to: 21 },
  { label: "Night 9pm–12am", from: 21, to: 24 },
];

function cellPct(v: number, max: number) {
  return v <= 0 ? 0 : Math.round(14 + 86 * Math.sqrt(v / max));
}

export function Heatmap() {
  const { report } = useReport();
  const grid = report.stats.heatmap;
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const max = useMemo(() => Math.max(1, ...grid.flat()), [grid]);
  const lateTotal = useMemo(() => grid.reduce((s, row) => s + row.slice(0, 5).reduce((a, b) => a + b, 0), 0), [grid]);
  const total = useMemo(() => grid.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0), [grid]);

  const busiest = useMemo(() => {
    let best = { d: 0, h: 0, v: -1 };
    grid.forEach((row, d) => row.forEach((v, h) => v > best.v && (best = { d, h, v })));
    return best;
  }, [grid]);

  const readout = hover
    ? `${WEEKDAYS_LONG[hover.d]} at ${hourLabel(hover.h)}: ${fmtNum(grid[hover.d][hover.h])} ${grid[hover.d][hover.h] === 1 ? "visit or message" : "visits and messages"}`
    : `Busiest: ${WEEKDAYS_LONG[busiest.d]} around ${hourLabel(busiest.h)}. ${total ? Math.round((lateTotal / total) * 100) : 0}% of all activity is after midnight.`;

  return (
    <ChartCard
      title="When they're online"
      description="Hour by weekday, from browsing and chat messages. Darker means busier."
      className="h-full"
      table={
        <DataTable
          columns={["Day", ...BUCKETS.map((b) => b.label)]}
          rows={grid.map((row, d) => [
            WEEKDAYS_LONG[d],
            ...BUCKETS.map((b) => row.slice(b.from, b.to).reduce((s, v) => s + v, 0)),
          ])}
        />
      }
    >
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[620px]">
          <div className="grid grid-cols-[2.6rem_1fr] gap-x-2">
            <div />
            <div className="relative">
              {/* late-night band label */}
              <div
                className="absolute -top-0.5 left-0 flex items-center gap-1 text-[0.7rem] font-medium text-[var(--glow-ink)]"
                style={{ width: "calc((100% - 69px) / 24 * 5 + 12px)" }}
              >
                <Moon className="size-3" /> Late night
              </div>
              <div className="grid pt-5 text-[0.68rem] text-muted-foreground" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))", columnGap: 3 }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="text-center tabular-nums">
                    {h % 3 === 0 ? hourLabel(h).replace("m", "") : ""}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-1.5 grid gap-[3px] text-xs text-muted-foreground" style={{ gridTemplateRows: "repeat(7, 1fr)" }}>
              {WEEKDAYS_MON_FIRST.map((d) => (
                <span key={d} className="flex items-center">
                  {d}
                </span>
              ))}
            </div>
            <div className="relative mt-1.5">
              <div
                aria-hidden
                className="absolute -inset-y-1 -left-1 rounded-xl bg-[color-mix(in_oklab,var(--chart-2)_15%,transparent)] ring-1 ring-[color-mix(in_oklab,var(--chart-2)_45%,transparent)]"
                style={{ width: "calc((100% - 69px) / 24 * 5 + 20px)" }}
              />
              <div
                className="relative grid gap-[3px]"
                style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
                onPointerLeave={() => setHover(null)}
                role="img"
                aria-label="Heatmap of activity by hour of the day and weekday. A table view is available."
              >
                {grid.map((row, d) =>
                  row.map((v, h) => (
                    <span
                      key={`${d}-${h}`}
                      onPointerEnter={() => setHover({ d, h })}
                      className="h-9 rounded-[5px] transition-transform duration-150 hover:scale-110 hover:ring-2 hover:ring-foreground/30"
                      style={{
                        background:
                          v > 0
                            ? `color-mix(in oklab, var(--chart-1) ${cellPct(v, max)}%, var(--card))`
                            : "color-mix(in oklab, var(--muted) 85%, transparent)",
                      }}
                    />
                  )),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="min-h-5 text-sm text-foreground/80 tabular-nums" aria-live="polite">
          {readout}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-hidden>
          Less
          {[0, 25, 50, 75, 100].map((p) => (
            <span
              key={p}
              className="size-3.5 rounded-[4px]"
              style={{ background: p === 0 ? "var(--muted)" : `color-mix(in oklab, var(--chart-1) ${14 + p * 0.86}%, var(--card))` }}
            />
          ))}
          More
        </div>
      </div>
    </ChartCard>
  );
}
