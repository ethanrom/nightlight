"use client";

import { useMemo } from "react";
import { Flag, Globe, MessagesSquare, MoonStar, Users } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import { CountUp, Stagger, StaggerItem } from "@/components/motion";
import { useReport } from "@/components/report/report-context";
import { fmtNum, localDayKey } from "@/lib/format";
import { severityRank } from "@/lib/rubric";
import { collectFindings } from "@/lib/ui-meta";

const fmtPctNum = (n: number) => `${Math.round(n)}`;

function Tile({
  label,
  icon: Icon,
  value,
  format,
  suffix,
  sub,
  spark,
  accent,
  sparkLabel,
}: {
  label: string;
  icon: typeof Globe;
  value: number;
  format?: (n: number) => string;
  suffix?: string;
  sub: string;
  spark: number[];
  accent?: string;
  sparkLabel: string;
}) {
  return (
    <StaggerItem>
      <div className="nl-card nl-card-hover flex h-full flex-col p-4 sm:p-5">
        <div className="flex items-center gap-2 text-[0.8rem] text-muted-foreground">
          <Icon className="size-3.5" />
          {label}
        </div>
        <p className="mt-3 flex items-baseline gap-0.5 text-[2.1rem] leading-none font-semibold tracking-tight">
          <CountUp value={value} format={format ?? fmtNum} tabular={false} />
          {suffix && <span className="text-xl text-muted-foreground">{suffix}</span>}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>
        <div className="mt-auto pt-4">
          <Sparkline values={spark} accent={accent} label={sparkLabel} />
        </div>
      </div>
    </StaggerItem>
  );
}

export function KpiRow() {
  const { report } = useReport();
  const data = useMemo(() => {
    const days = report.stats.perDay.map((d) => d.date);
    const visits = report.stats.perDay.map((d) => d.visits);
    const late = report.stats.perDay.map((d) => d.lateNight);
    const findings = collectFindings(report).filter((f) => !f.normal);
    const bucket = (whens: (number | undefined)[]) => {
      const m = new Map<string, number>();
      for (const w of whens) if (w) m.set(localDayKey(w), (m.get(localDayKey(w)) ?? 0) + 1);
      return days.map((d) => m.get(d) ?? 0);
    };
    const talk = findings.filter((f) => severityRank(f.severity) >= 2);
    return {
      visits,
      late,
      flags: findings.length,
      talk: talk.length,
      convs: bucket(report.conversations.map((c) => c.startedAt)),
      flagSpark: bucket(findings.map((f) => f.when)),
      talkSpark: bucket(talk.map((f) => f.when)),
    };
  }, [report]);

  const { stats } = report;
  return (
    <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5" gap={0.06} delay={0.1}>
      <Tile
        label="Pages analysed"
        icon={Globe}
        value={stats.analysed.historyItems}
        sub={`of ${fmtNum(stats.analysed.historyTotal)} found`}
        spark={data.visits}
        sparkLabel="Visits per day"
      />
      <Tile
        label="AI conversations"
        icon={MessagesSquare}
        value={stats.conversations}
        sub={`${fmtNum(stats.childMessages)} messages from your child`}
        spark={data.convs}
        sparkLabel="Conversations per day"
      />
      <Tile
        label="Flags raised"
        icon={Flag}
        value={data.flags}
        sub="things worth a look"
        spark={data.flagSpark}
        sparkLabel="Flags per day"
      />
      <Tile
        label="Need a talk"
        icon={Users}
        value={data.talk}
        sub="talk soon or urgent"
        spark={data.talkSpark}
        sparkLabel="Items needing a talk per day"
      />
      <Tile
        label="Late-night share"
        icon={MoonStar}
        value={stats.lateNightShare * 100}
        format={fmtPctNum}
        suffix="%"
        sub="of activity, midnight to 5am"
        spark={data.late}
        accent="var(--chart-2)"
        sparkLabel="Late-night visits per day"
      />
    </Stagger>
  );
}
