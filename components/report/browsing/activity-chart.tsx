"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, DataTable, LegendItem, useChartReady } from "@/components/charts/chart-card";
import { useReport } from "@/components/report/report-context";
import { SeverityDot } from "@/components/severity";
import { dayKeyToMs, fmtDate, fmtNum, localDayKey } from "@/lib/format";
import { severityRank, type Severity } from "@/lib/rubric";
import { SEVERITY_STYLE, collectFindings } from "@/lib/ui-meta";
import { Moon } from "lucide-react";

interface Day {
  date: string;
  t: number;
  day: number;
  late: number;
  total: number;
  flags: number;
  sev: Severity | null;
}

const TICK = { fill: "var(--chart-muted)", fontSize: 12 };

function roundTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

interface ShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: Day;
}

function DayShape({ x = 0, y = 0, width = 0, height = 0, payload }: ShapeProps) {
  if (!payload || height <= 0) return null;
  const top = payload.late === 0;
  return (
    <path
      d={top ? roundTop(x, y, width, height, 4) : `M${x},${y} h${width} v${height} h${-width} Z`}
      fill="var(--chart-1)"
      stroke="var(--card)"
      strokeWidth={2}
    />
  );
}

function LateShape({ x = 0, y = 0, width = 0, height = 0, payload }: ShapeProps) {
  if (!payload) return null;
  const cx = x + width / 2;
  return (
    <g>
      {height > 0 && (
        <path d={roundTop(x, y, width, height, 4)} fill="var(--chart-2)" stroke="var(--card)" strokeWidth={2} />
      )}
      {payload.flags > 0 && payload.sev && (
        <circle
          cx={cx}
          cy={y - 11}
          r={4.5}
          fill={SEVERITY_STYLE[payload.sev].cssVar}
          stroke="var(--card)"
          strokeWidth={2}
        />
      )}
    </g>
  );
}

function ActivityTooltip({ active, payload }: { active?: boolean; payload?: { payload: Day }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="min-w-44 rounded-xl border border-border bg-popover px-3.5 py-3 text-popover-foreground shadow-lg">
      <p className="text-xs text-muted-foreground">
        {new Date(d.t).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
      </p>
      <p className="mt-1 text-lg leading-none font-semibold tabular-nums">{fmtNum(d.total)} visits</p>
      <div className="mt-2.5 space-y-1.5 text-xs">
        <p className="flex items-center gap-2 text-muted-foreground">
          <span className="h-0.5 w-3 rounded bg-chart-1" /> Daytime{" "}
          <span className="ml-auto font-medium text-foreground tabular-nums">{fmtNum(d.day)}</span>
        </p>
        <p className="flex items-center gap-2 text-muted-foreground">
          <span className="h-0.5 w-3 rounded bg-chart-2" /> After midnight{" "}
          <span className="ml-auto font-medium text-foreground tabular-nums">{fmtNum(d.late)}</span>
        </p>
        {d.flags > 0 && d.sev && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <SeverityDot severity={d.sev} /> Flagged{" "}
            <span className="ml-auto font-medium text-foreground tabular-nums">{d.flags}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export function ActivityChart() {
  const { report } = useReport();
  const ready = useChartReady();
  const data = useMemo<Day[]>(() => {
    const flagsByDay = new Map<string, { n: number; sev: Severity }>();
    for (const f of collectFindings(report)) {
      if (f.normal || !f.when) continue;
      const k = localDayKey(f.when);
      const cur = flagsByDay.get(k);
      if (!cur) flagsByDay.set(k, { n: 1, sev: f.severity });
      else
        flagsByDay.set(k, {
          n: cur.n + 1,
          sev: severityRank(f.severity) > severityRank(cur.sev) ? f.severity : cur.sev,
        });
    }
    return report.stats.perDay.map((d) => {
      const fl = flagsByDay.get(d.date);
      return {
        date: d.date,
        t: dayKeyToMs(d.date),
        day: d.visits - d.lateNight,
        late: d.lateNight,
        total: d.visits,
        flags: fl?.n ?? 0,
        sev: fl?.sev ?? null,
      };
    });
  }, [report]);

  const peak = data.reduce((m, d) => (d.total > m.total ? d : m), data[0] ?? { total: 0, t: 0 });

  return (
    <ChartCard
      title="Activity over time"
      description={
        data.length ? `Busiest day: ${fmtDate(peak.t)} with ${fmtNum(peak.total)} visits.` : "Visits per day"
      }
      legend={
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <LegendItem shape="bar" color="var(--chart-1)">
            Daytime
          </LegendItem>
          <LegendItem shape="bar" color="var(--chart-2)">
            After midnight (12–5am)
          </LegendItem>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <SeverityDot severity="worth_noticing" />
              <SeverityDot severity="talk_soon" />
              <SeverityDot severity="urgent" />
            </span>
            A flagged item that day
          </span>
        </div>
      }
      table={
        <DataTable
          columns={["Date", "Visits", "After midnight", "Flagged items"]}
          rows={data.map((d) => [fmtDate(d.t), d.total, d.late, d.flags])}
        />
      }
    >
      <div
        className="h-[280px] w-full"
        role="img"
        aria-label="Stacked bar chart of visits per day, with the after-midnight share highlighted"
      >
        {ready && (
          <ResponsiveContainer width="100%" height={280} initialDimension={{ width: 1000, height: 280 }}>
            <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: -8 }} barCategoryGap="22%">
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={(t: number) => fmtDate(t)}
                tick={TICK}
                tickLine={false}
                axisLine={{ stroke: "var(--chart-axis)" }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis tick={TICK} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
              <Tooltip content={<ActivityTooltip />} cursor={{ fill: "var(--chart-grid)" }} />
              <Bar
                dataKey="day"
                stackId="v"
                maxBarSize={22}
                shape={<DayShape />}
                isAnimationActive
                animationDuration={800}
              />
              <Bar
                dataKey="late"
                stackId="v"
                maxBarSize={22}
                shape={<LateShape />}
                isAnimationActive
                animationDuration={800}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Moon className="size-3 text-[var(--glow-ink)]" />
        Amber is activity between midnight and 5am. Rising late-night share is often the first sign of sleep disruption.
      </p>
    </ChartCard>
  );
}
