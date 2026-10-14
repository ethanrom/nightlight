"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Calculator, ChartLine, Moon, Table2 } from "lucide-react";
import { DataTable, LegendItem, useChartReady } from "@/components/charts/chart-card";
import { useReport } from "@/components/report/report-context";
import { Button } from "@/components/ui/button";
import type { CardOf } from "@/lib/chat-cards";
import { dayKeyToMs, fmtDate, fmtDateTime, fmtNum, hourLabel, isLateNight, plural } from "@/lib/format";
import { MOOD_META, moodMeta } from "@/lib/ui-meta";
import type { Report } from "@/lib/types";
import { cn } from "@/lib/utils";

// Every number on these charts is computed here from the report. The model only picks WHICH chart to show.
// Colours are the app's validated chart tokens (see globals.css): indigo = daytime, amber = after midnight.

const TICK = { fill: "var(--chart-muted)", fontSize: 11 };
const AXIS = { stroke: "var(--chart-axis)" };
const H = 176;

function roundTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

function TipBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-40 rounded-xl border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-lg">
      <p className="text-xs text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ frame

function Frame({
  title,
  subtitle,
  legend,
  control,
  table,
  children,
  footnote,
}: {
  title: string;
  subtitle?: string;
  legend?: React.ReactNode;
  control?: React.ReactNode;
  table: React.ReactNode;
  children: React.ReactNode;
  footnote?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="nl-card min-w-0 p-4" aria-label={title}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-title text-[0.95rem]">{title}</h4>
          {subtitle && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {control}
          <Button
            variant="ghost"
            size="xs"
            className="rounded-full text-muted-foreground"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
          >
            {asTable ? <ChartLine /> : <Table2 />}
            {asTable ? "Chart" : "Table"}
          </Button>
        </div>
      </div>
      {legend && !asTable && <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">{legend}</div>}
      <div className="mt-3">
        {asTable ? <div className="max-h-48 overflow-auto rounded-xl border border-border">{table}</div> : children}
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Calculator className="size-3 shrink-0" />
        {footnote ?? "Calculated from the report’s data, not written by the AI."}
      </p>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="grid h-28 place-items-center text-center text-sm text-muted-foreground">{children}</p>;
}

/** Segmented control, same look as the region filter on the Concerns tab. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-0.5 rounded-full bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "h-6 rounded-full px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            value === o.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ daily activity

interface Day {
  t: number;
  day: number;
  late: number;
  total: number;
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
  const d = payload.late === 0 ? roundTop(x, y, width, height, 4) : `M${x},${y} h${width} v${height} h${-width} Z`;
  return <path d={d} fill="var(--chart-1)" stroke="var(--card)" strokeWidth={2} />;
}

function LateShape({ x = 0, y = 0, width = 0, height = 0 }: ShapeProps) {
  if (height <= 0) return null;
  return <path d={roundTop(x, y, width, height, 4)} fill="var(--chart-2)" stroke="var(--card)" strokeWidth={2} />;
}

function dailyData(report: Report): Day[] {
  return report.stats.perDay.map((d) => ({
    t: dayKeyToMs(d.date),
    day: d.visits - d.lateNight,
    late: d.lateNight,
    total: d.visits,
  }));
}

function DailyActivity({ report, title }: { report: Report; title?: string }) {
  const ready = useChartReady();
  const data = useMemo(() => dailyData(report), [report]);
  const peak = data.reduce<Day | null>((m, d) => (!m || d.total > m.total ? d : m), null);
  if (!data.length) return <Frame title={title ?? "Activity per day"} table={null}><Empty>No browsing history was analysed.</Empty></Frame>;
  return (
    <Frame
      title={title ?? "Activity per day"}
      subtitle={peak ? `Busiest day: ${fmtDate(peak.t)}, with ${plural(peak.total, "visit")}.` : undefined}
      legend={
        <>
          <LegendItem shape="bar" color="var(--chart-1)">
            Daytime
          </LegendItem>
          <LegendItem shape="bar" color="var(--chart-2)">
            After midnight (12–5am)
          </LegendItem>
        </>
      }
      table={<DataTable columns={["Date", "Visits", "After midnight"]} rows={data.map((d) => [fmtDate(d.t), d.total, d.late])} />}
    >
      <div className="w-full" style={{ height: H }} role="img" aria-label="Bar chart of browsing visits per day, with the after-midnight share highlighted">
        {ready && (
          <ResponsiveContainer width="100%" height={H} initialDimension={{ width: 560, height: H }}>
            <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -16 }} barCategoryGap="22%">
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="t" tickFormatter={(t: number) => fmtDate(t)} tick={TICK} tickLine={false} axisLine={AXIS} interval="preserveStartEnd" minTickGap={26} />
              <YAxis tick={TICK} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--chart-grid)" }}
                content={({ active, payload }) => {
                  const d = active ? (payload?.[0]?.payload as Day | undefined) : undefined;
                  if (!d) return null;
                  return (
                    <TipBox title={new Date(d.t).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}>
                      <p className="mt-1 text-base leading-none font-semibold tabular-nums">{plural(d.total, "visit")}</p>
                      <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="h-0.5 w-3 rounded bg-chart-2" /> After midnight
                        <span className="ml-auto font-medium text-foreground tabular-nums">{fmtNum(d.late)}</span>
                      </p>
                    </TipBox>
                  );
                }}
              />
              <Bar dataKey="day" stackId="v" maxBarSize={16} shape={<DayShape />} animationDuration={700} />
              <Bar dataKey="late" stackId="v" maxBarSize={16} shape={<LateShape />} animationDuration={700} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Frame>
  );
}

// ------------------------------------------------------------------ late night

type LateView = "nights" | "hours";

function LateNight({ report, title }: { report: Report; title?: string }) {
  const ready = useChartReady();
  const [view, setView] = useState<LateView>("nights");
  const nights = useMemo(() => dailyData(report), [report]);
  const hours = useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => ({
        h,
        label: hourLabel(h),
        count: report.stats.heatmap.reduce((s, row) => s + (row?.[h] ?? 0), 0),
      })),
    [report],
  );
  const peakNight = nights.reduce<Day | null>((m, d) => (!m || d.late > m.late ? d : m), null);
  const nightsWithLate = nights.filter((d) => d.late > 0).length;
  const share = Math.round(report.stats.lateNightShare * 100);
  const subtitle =
    view === "nights"
      ? peakNight && peakNight.late > 0
        ? `${plural(nightsWithLate, "day")} had activity after midnight. Peak: ${fmtDate(peakNight.t)}, with ${plural(peakNight.late, "visit")}.`
        : "No browsing was recorded after midnight."
      : `${share}% of all activity falls between midnight and 5am.`;

  return (
    <Frame
      title={title ?? "After-midnight activity"}
      subtitle={subtitle}
      control={
        <Segmented
          label="Chart view"
          value={view}
          onChange={setView}
          options={[
            { id: "nights", label: "By day" },
            { id: "hours", label: "By hour" },
          ]}
        />
      }
      legend={
        view === "hours" ? (
          <>
            <LegendItem shape="bar" color="var(--chart-2)">
              Midnight to 5am
            </LegendItem>
            <LegendItem shape="bar" color="var(--chart-3)">
              Rest of the day
            </LegendItem>
          </>
        ) : undefined
      }
      table={
        view === "nights" ? (
          <DataTable columns={["Date", "After-midnight visits"]} rows={nights.map((d) => [fmtDate(d.t), d.late])} />
        ) : (
          <DataTable columns={["Hour", "Activity"]} rows={hours.map((h) => [h.label, h.count])} />
        )
      }
      footnote={
        view === "hours"
          ? "Calculated from the report’s data: browsing visits plus chat messages, all days combined."
          : undefined
      }
    >
      <div className="w-full" style={{ height: H }} role="img" aria-label={view === "nights" ? "Bar chart of after-midnight visits per day" : "Bar chart of activity by hour of the day"}>
        {ready && view === "nights" && (
          <ResponsiveContainer width="100%" height={H} initialDimension={{ width: 560, height: H }}>
            <BarChart data={nights} margin={{ top: 14, right: 4, bottom: 0, left: -16 }} barCategoryGap="22%">
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="t" tickFormatter={(t: number) => fmtDate(t)} tick={TICK} tickLine={false} axisLine={AXIS} interval="preserveStartEnd" minTickGap={26} />
              <YAxis tick={TICK} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--chart-grid)" }}
                content={({ active, payload }) => {
                  const d = active ? (payload?.[0]?.payload as Day | undefined) : undefined;
                  if (!d) return null;
                  return (
                    <TipBox title={new Date(d.t).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}>
                      <p className="mt-1 flex items-center gap-1.5 text-base leading-none font-semibold tabular-nums">
                        <Moon className="size-3.5 text-[var(--glow-ink)]" />
                        {plural(d.late, "visit")}
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">after midnight</p>
                    </TipBox>
                  );
                }}
              />
              <Bar
                dataKey="late"
                maxBarSize={16}
                animationDuration={700}
                shape={(p: ShapeProps) => {
                  const { x = 0, y = 0, width = 0, height = 0, payload } = p;
                  if (!payload || height <= 0) return <g />;
                  const isPeak = peakNight && payload.t === peakNight.t;
                  return (
                    <g>
                      <path d={roundTop(x, y, width, height, 4)} fill="var(--chart-2)" stroke="var(--card)" strokeWidth={2} />
                      {isPeak && (
                        <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--foreground)">
                          {payload.late}
                        </text>
                      )}
                    </g>
                  );
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
        {ready && view === "hours" && (
          <ResponsiveContainer width="100%" height={H} initialDimension={{ width: 560, height: H }}>
            <BarChart data={hours} margin={{ top: 6, right: 4, bottom: 0, left: -16 }} barCategoryGap="18%">
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={AXIS} interval={2} />
              <YAxis tick={TICK} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--chart-grid)" }}
                content={({ active, payload }) => {
                  const d = active ? (payload?.[0]?.payload as (typeof hours)[number] | undefined) : undefined;
                  if (!d) return null;
                  return (
                    <TipBox title={d.label}>
                      <p className="mt-1 text-base leading-none font-semibold tabular-nums">{fmtNum(d.count)} actions</p>
                      {d.h < 5 && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--glow-ink)]">
                          <Moon className="size-3" /> after midnight
                        </p>
                      )}
                    </TipBox>
                  );
                }}
              />
              <Bar dataKey="count" maxBarSize={16} radius={[4, 4, 0, 0]} animationDuration={700}>
                {hours.map((h) => (
                  <Cell key={h.h} fill={h.h < 5 ? "var(--chart-2)" : "var(--chart-3)"} fillOpacity={h.h < 5 ? 1 : 0.55} stroke="var(--card)" strokeWidth={2} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Frame>
  );
}

// ------------------------------------------------------------------ mood

interface MoodPoint {
  t: number;
  mood: number;
  late: boolean;
  title: string;
  platform: string;
}

function MoodDot(props: { cx?: number; cy?: number; payload?: MoodPoint }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  if (payload.late) {
    return <rect x={cx - 5.5} y={cy - 5.5} width={11} height={11} rx={2} transform={`rotate(45 ${cx} ${cy})`} fill="var(--chart-2)" stroke="var(--card)" strokeWidth={2} />;
  }
  return <circle cx={cx} cy={cy} r={5} fill="var(--chart-1)" stroke="var(--card)" strokeWidth={2} />;
}

function MoodTrend({ report, title }: { report: Report; title?: string }) {
  const ready = useChartReady();
  const data = useMemo<MoodPoint[]>(() => {
    const convs = new Map(report.conversations.map((c) => [c.id, c]));
    const out: MoodPoint[] = [];
    for (const a of report.chatAudits) {
      const c = convs.get(a.id);
      if (!c?.startedAt) continue;
      out.push({ t: c.startedAt, mood: a.child_mood, late: isLateNight(c.startedAt), title: c.title, platform: c.platform });
    }
    return out.sort((a, b) => a.t - b.t);
  }, [report]);

  const avg = (xs: MoodPoint[]) => (xs.length ? xs.reduce((s, d) => s + d.mood, 0) / xs.length : null);
  const lateAvg = avg(data.filter((d) => d.late));
  const dayAvg = avg(data.filter((d) => !d.late));
  const lowest = data.reduce<MoodPoint | null>((m, d) => (!m || d.mood < m.mood ? d : m), null);
  const subtitle =
    lateAvg != null && dayAvg != null
      ? `Chats after midnight average ${lateAvg.toFixed(1)}, against ${dayAvg.toFixed(1)} at other times. Lowest: ${lowest ? fmtDate(lowest.t) : "n/a"}.`
      : "How the child seemed to feel in each conversation. Not a diagnosis.";

  return (
    <Frame
      title={title ?? "Mood across chats"}
      subtitle={data.length >= 2 ? subtitle : undefined}
      legend={
        data.length >= 2 ? (
          <>
            <LegendItem color="var(--chart-1)">Daytime or evening chat</LegendItem>
            <LegendItem shape="diamond" color="var(--chart-2)">
              After midnight
            </LegendItem>
          </>
        ) : undefined
      }
      table={
        <DataTable
          columns={["Date", "Conversation", "Mood"]}
          rows={data.map((d) => [fmtDateTime(d.t), `${d.platform}: ${d.title}`, moodMeta(d.mood).label])}
        />
      }
    >
      {data.length < 2 ? (
        <Empty>Not enough dated conversations to draw a trend yet.</Empty>
      ) : (
        <div className="w-full" style={{ height: H }} role="img" aria-label="Line chart of the child's mood in each AI conversation over time">
          {ready && (
            <ResponsiveContainer width="100%" height={H} initialDimension={{ width: 560, height: H }}>
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t: number) => fmtDate(t)}
                  tick={TICK}
                  tickLine={false}
                  axisLine={AXIS}
                  padding={{ left: 14, right: 14 }}
                  minTickGap={30}
                />
                <YAxis
                  domain={[-2.6, 2.6]}
                  ticks={[-2, 0, 2]}
                  tickFormatter={(v: number) => MOOD_META[v]?.axis ?? ""}
                  tick={TICK}
                  tickLine={false}
                  axisLine={false}
                  width={68}
                />
                <ReferenceLine y={0} stroke="var(--chart-axis)" />
                <Tooltip
                  cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    const p = active ? (payload?.[0]?.payload as MoodPoint | undefined) : undefined;
                    if (!p) return null;
                    const m = moodMeta(p.mood);
                    return (
                      <TipBox title={`${p.platform} · ${p.title}`}>
                        <p className="mt-1 text-base leading-none font-semibold">
                          {m.emoji} {m.label}
                        </p>
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs tabular-nums">
                          {fmtDateTime(p.t)}
                          {p.late && (
                            <span className="inline-flex items-center gap-1 text-[var(--glow-ink)]">
                              <Moon className="size-3" /> after midnight
                            </span>
                          )}
                        </p>
                      </TipBox>
                    );
                  }}
                />
                <Line
                  type="linear"
                  dataKey="mood"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={(p: object) => <MoodDot {...(p as object)} key={(p as { index?: number }).index} />}
                  activeDot={(p: object) => <MoodDot {...(p as object)} />}
                  animationDuration={800}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </Frame>
  );
}

// ------------------------------------------------------------------ card

export function ChartCard({ card }: { card: CardOf<"chart"> }) {
  const { report } = useReport();
  switch (card.kind) {
    case "daily_activity":
      return <DailyActivity report={report} title={card.title} />;
    case "late_night":
      return <LateNight report={report} title={card.title} />;
    case "mood_trend":
      return <MoodTrend report={report} title={card.title} />;
  }
}
