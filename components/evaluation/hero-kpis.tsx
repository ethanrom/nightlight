import { Stagger, StaggerItem } from "@/components/motion";
import { Meter } from "@/components/evaluation/eval-ui";
import { METHOD_META, fmtCost, fmtDuration, fmtGenerated, scoreRatio, scoreText } from "@/components/evaluation/eval-utils";
import { SeverityDot } from "@/components/severity";
import type { EvalResults, MethodId, Score } from "@/lib/eval-types";
import { fmtNum } from "@/lib/format";

const BASELINES: MethodId[] = ["moderation", "single_chat"];

function NightlightTag() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/70">
      <span aria-hidden className="size-2 rounded-full bg-primary" />
      Nightlight
    </span>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="nl-card flex h-full flex-col p-5 sm:p-6">
      <h3 className="text-[0.95rem] leading-snug font-medium text-foreground/90">{label}</h3>
      {children}
    </div>
  );
}

function BigScore({ score }: { score: Score }) {
  return (
    <div className="mt-4 flex items-baseline gap-3">
      <span className="text-display text-[2.75rem] leading-none">
        {fmtNum(score[0])}
        <span className="text-muted-foreground/70">/{fmtNum(score[1])}</span>
      </span>
      <NightlightTag />
    </div>
  );
}

/** Nightlight's score as the big figure, then the two baselines smaller on the same scale. */
function ScoreTile({
  label,
  scores,
  caption,
}: {
  label: string;
  scores: Record<MethodId, Score>;
  caption?: string;
}) {
  return (
    <Tile label={label}>
      <BigScore score={scores.nightlight} />
      <Meter value={scoreRatio(scores.nightlight)} className="mt-3.5 h-2" />
      {caption && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{caption}</p>}
      <ul className="mt-auto space-y-2 pt-5">
        {BASELINES.map((m) => (
          <li key={m} className="grid grid-cols-[7.25rem_1fr_2.6rem] items-center gap-3 text-xs">
            <span className="truncate text-muted-foreground">{METHOD_META[m].short}</span>
            <Meter value={scoreRatio(scores[m])} tone="muted" className="h-1.5" />
            <span className="text-right font-medium text-foreground/80 tabular-nums">{scoreText(scores[m])}</span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}

function AlarmCounts({ talk, notice, small }: { talk: number; notice: number; small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3 tabular-nums">
      <span className="inline-flex items-center gap-1.5" title="Talk soon or urgent">
        <SeverityDot severity="talk_soon" />
        <span className="sr-only">Talk soon or urgent: </span>
        <span className={small ? "font-medium text-foreground/80" : undefined}>{fmtNum(talk)}</span>
      </span>
      <span className="inline-flex items-center gap-1.5" title="Worth noticing">
        <SeverityDot severity="worth_noticing" />
        <span className="sr-only">Worth noticing: </span>
        <span className={small ? "font-medium text-foreground/80" : undefined}>{fmtNum(notice)}</span>
      </span>
    </span>
  );
}

function AlarmTile({ results }: { results: EvalResults }) {
  const fa = results.headline.falseAlarms;
  const nl = fa.nightlight;
  return (
    <Tile label={`False alarms on ${fmtNum(nl.outOf)} harmless items`}>
      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-display text-[2.75rem] leading-none">{fmtNum(nl.talkSoonOrUrgent)}</span>
        <NightlightTag />
      </div>
      <p className="mt-3.5 flex items-center gap-2 text-sm text-foreground/85">
        <SeverityDot severity="talk_soon" />
        talk soon or urgent
      </p>
      <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        <SeverityDot severity="worth_noticing" />
        <span className="tabular-nums">{fmtNum(nl.worthNoticing)}</span> worth noticing (mild)
      </p>
      <ul className="mt-auto space-y-2 pt-5">
        {BASELINES.map((m) => (
          <li key={m} className="grid grid-cols-[7.25rem_1fr] items-center gap-3 text-xs">
            <span className="truncate text-muted-foreground">{METHOD_META[m].short}</span>
            <span className="text-right">
              <AlarmCounts talk={fa[m].talkSoonOrUrgent} notice={fa[m].worthNoticing} small />
            </span>
          </li>
        ))}
      </ul>
    </Tile>
  );
}

function SoloTile({
  label,
  big,
  ratio,
  caption,
}: {
  label: string;
  big: React.ReactNode;
  ratio: number;
  caption: string;
}) {
  return (
    <Tile label={label}>
      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-display text-[2.75rem] leading-none">{big}</span>
        <NightlightTag />
      </div>
      <Meter value={ratio} className="mt-3.5 h-2" />
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{caption}</p>
    </Tile>
  );
}

export function HeroKpis({ results }: { results: EvalResults }) {
  const { headline: h, runs } = results;
  const [sevHit, sevTotal] = h.severityCorrect.nightlight;
  return (
    <>
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" delay={0.15}>
        <StaggerItem className="h-full">
          <ScoreTile
            label="Planted signals caught"
            scores={h.signalsCaught}
            caption={`${fmtNum(sevHit)} of ${fmtNum(sevTotal)} also at the right severity or higher.`}
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <ScoreTile
            label="Patterns across conversations"
            scores={h.patternsFound}
            caption="Trends that only show when several chats and searches are read together."
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <AlarmTile results={results} />
        </StaggerItem>
        <StaggerItem className="h-full">
          <ScoreTile
            label="Normal things left alone"
            scores={h.normalHandled}
            caption="Healthy questions that should not be raised as a concern."
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <SoloTile
            label={`Same verdict across ${fmtNum(runs)} runs`}
            big={`${Math.round(h.consistency * 100)}%`}
            ratio={h.consistency}
            caption={`Share of signal and pattern verdicts that came out identical in every one of the ${fmtNum(runs)} runs.`}
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <SoloTile
            label="AI replies graded correctly"
            big={
              <>
                {fmtNum(h.aiGradeAccuracy[0])}
                <span className="text-muted-foreground/70">/{fmtNum(h.aiGradeAccuracy[1])}</span>
              </>
            }
            ratio={scoreRatio(h.aiGradeAccuracy)}
            caption="Nightlight’s grade for how the chatbot answered the child matched an accepted grade."
          />
        </StaggerItem>
      </Stagger>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        Each Nightlight run took about <span className="tabular-nums">{fmtDuration(h.secondsPerRun)}</span> and cost about{" "}
        <span className="tabular-nums">{fmtCost(h.costUsdPerRun)}</span>. Results generated {fmtGenerated(results.generatedAt)}.
      </p>
    </>
  );
}
