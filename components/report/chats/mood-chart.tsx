"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Moon } from "lucide-react";
import { ChartCard, DataTable, LegendItem, useChartReady } from "@/components/charts/chart-card";
import { useReport } from "@/components/report/report-context";
import { fmtDate, fmtDateTime, isLateNight } from "@/lib/format";
import { MOOD_META, moodMeta } from "@/lib/ui-meta";

interface Point {
  id: string;
  t: number;
  mood: number;
  late: boolean;
  title: string;
  platform: string;
  reliance: string;
}

const TICK = { fill: "var(--chart-muted)", fontSize: 12 };

function MoodDot(props: { cx?: number; cy?: number; payload?: Point; active?: boolean }) {
  const { cx, cy, payload, active } = props;
  if (cx == null || cy == null || !payload) return null;
  const grow = active ? 1.35 : 1;
  if (payload.late) {
    const s = 6.5 * grow;
    return (
      <rect
        x={cx - s}
        y={cy - s}
        width={s * 2}
        height={s * 2}
        rx={2}
        transform={`rotate(45 ${cx} ${cy})`}
        fill="var(--chart-2)"
        stroke="var(--card)"
        strokeWidth={2}
      />
    );
  }
  return <circle cx={cx} cy={cy} r={5.5 * grow} fill="var(--chart-1)" stroke="var(--card)" strokeWidth={2} />;
}

function MoodTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const m = moodMeta(p.mood);
  return (
    <div className="max-w-64 rounded-xl border border-border bg-popover px-3.5 py-3 text-popover-foreground shadow-lg">
      <p className="text-base font-semibold">
        {m.emoji} {m.label}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {p.platform} · {p.title}
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-xs tabular-nums">
        {fmtDateTime(p.t)}
        {p.late && (
          <span className="inline-flex items-center gap-1 text-[var(--glow-ink)]">
            <Moon className="size-3" /> after midnight
          </span>
        )}
      </p>
    </div>
  );
}

export function MoodChart() {
  const { report } = useReport();
  const ready = useChartReady();
  const data = useMemo<Point[]>(() => {
    const convs = new Map(report.conversations.map((c) => [c.id, c]));
    const out: Point[] = [];
    for (const a of report.chatAudits) {
      const c = convs.get(a.id);
      if (!c?.startedAt) continue;
      out.push({
        id: a.id,
        t: c.startedAt,
        mood: a.child_mood,
        late: isLateNight(c.startedAt),
        title: c.title,
        platform: c.platform,
        reliance: a.reliance_level,
      });
    }
    return out.sort((a, b) => a.t - b.t);
  }, [report]);

  const lateAvg = useMemo(() => {
    const late = data.filter((d) => d.late);
    return late.length ? late.reduce((s, d) => s + d.mood, 0) / late.length : null;
  }, [data]);
  const dayAvg = useMemo(() => {
    const day = data.filter((d) => !d.late);
    return day.length ? day.reduce((s, d) => s + d.mood, 0) / day.length : null;
  }, [data]);

  return (
    <ChartCard
      title="Mood over time"
      description={
        lateAvg != null && dayAvg != null && data.some((d) => d.late)
          ? `Chats after midnight average ${lateAvg.toFixed(1)}, against ${dayAvg.toFixed(1)} at other times.`
          : "How your child seemed to feel in each conversation. Not a diagnosis."
      }
      legend={
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <LegendItem color="var(--chart-1)">Daytime or evening chat</LegendItem>
          <LegendItem shape="diamond" color="var(--chart-2)">
            After midnight (12–5am)
          </LegendItem>
          <span className="ml-auto text-xs text-muted-foreground">Scale: Low → Positive</span>
        </div>
      }
      table={
        <DataTable
          columns={["Date", "Conversation", "Mood", "After midnight"]}
          rows={data.map((d) => [
            fmtDateTime(d.t),
            `${d.platform}: ${d.title}`,
            moodMeta(d.mood).label,
            d.late ? "Yes" : "No",
          ])}
        />
      }
    >
      {data.length < 2 ? (
        <p className="grid h-48 place-items-center text-sm text-muted-foreground">
          Not enough dated conversations to draw a trend yet.
        </p>
      ) : (
        <div
          className="h-[290px] w-full"
          role="img"
          aria-label="Line chart of your child's mood in each AI conversation over time"
        >
          {ready && (
            <ResponsiveContainer width="100%" height={290} initialDimension={{ width: 720, height: 290 }}>
              <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t: number) => fmtDate(t)}
                  tick={TICK}
                  tickLine={false}
                  axisLine={{ stroke: "var(--chart-axis)" }}
                  padding={{ left: 24, right: 24 }}
                  minTickGap={36}
                />
                <YAxis
                  domain={[-2.6, 2.6]}
                  ticks={[-2, -1, 0, 1, 2]}
                  tickFormatter={(v: number) => MOOD_META[v]?.axis ?? ""}
                  tick={TICK}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                />
                <ReferenceLine y={0} stroke="var(--chart-axis)" />
                <Tooltip content={<MoodTooltip />} cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }} />
                <Line
                  type="linear"
                  dataKey="mood"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={(p: object) => <MoodDot {...(p as object)} key={(p as { index?: number }).index} />}
                  activeDot={(p: object) => <MoodDot {...(p as object)} active />}
                  isAnimationActive
                  animationDuration={900}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </ChartCard>
  );
}
