import { Stagger, StaggerItem } from "@/components/motion";
import { METHOD_META, scoreText } from "@/components/evaluation/eval-utils";
import type { EvalResults, MethodId } from "@/lib/eval-types";
import { METHOD_IDS } from "@/lib/eval-types";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

const SEES: Record<MethodId, string> = {
  moderation:
    "Checks every search, page title and message on its own against a list of harmful topics. This is what a chatbot’s own moderation sees.",
  single_chat:
    "Nightlight’s child-development rubric applied to each conversation by itself, with no summary across conversations or browsing.",
  nightlight:
    "The full pipeline: browsing history and every chat read together through a child-development lens, with a cross-conversation summary.",
};

/** A tiny picture of how much each method sees at once: single messages, single chats, or everything linked. */
function ScopeGlyph({ method }: { method: MethodId }) {
  const groups = [8, 90, 172];
  return (
    <svg viewBox="0 0 240 58" className="h-auto w-full max-w-[15rem]" aria-hidden fill="none">
      {groups.map((gx) => (
        <g key={gx}>
          {method === "single_chat" || method === "nightlight" ? (
            <rect x={gx} y={3} width={60} height={52} rx={9} stroke="currentColor" strokeWidth={1.25} opacity={0.5} />
          ) : null}
          {[
            { x: gx + 6, y: 10, w: 36 },
            { x: gx + 18, y: 24, w: 36 },
            { x: gx + 6, y: 38, w: 28 },
          ].map((b) => (
            <g key={b.y}>
              <rect x={b.x} y={b.y} width={b.w} height={8} rx={4} fill="currentColor" opacity={0.28} />
              {method === "moderation" && (
                <rect
                  x={b.x - 3}
                  y={b.y - 3}
                  width={b.w + 6}
                  height={14}
                  rx={7}
                  stroke="currentColor"
                  strokeWidth={1.25}
                  opacity={0.55}
                />
              )}
            </g>
          ))}
        </g>
      ))}
      {method === "nightlight" && (
        <g stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
          <path d="M68 29 H90" />
          <path d="M150 29 H172" />
          <circle cx={68} cy={29} r={3} fill="currentColor" stroke="none" />
          <circle cx={90} cy={29} r={3} fill="currentColor" stroke="none" />
          <circle cx={150} cy={29} r={3} fill="currentColor" stroke="none" />
          <circle cx={172} cy={29} r={3} fill="currentColor" stroke="none" />
        </g>
      )}
    </svg>
  );
}

function MethodScoreRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export function MethodCards({ results }: { results: EvalResults }) {
  const { headline: h, runs } = results;
  return (
    <Stagger className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {METHOD_IDS.map((m) => {
        const meta = METHOD_META[m];
        const Icon = meta.icon;
        const nl = m === "nightlight";
        return (
          <StaggerItem key={m} className="h-full">
            <article
              className={cn(
                "nl-card flex h-full flex-col p-6",
                nl && "border-[color-mix(in_oklab,var(--primary)_35%,var(--border))] bg-[color-mix(in_oklab,var(--primary)_5%,var(--card))]",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-2xl",
                    nl ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/75",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-title text-lg">{meta.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {nl ? `Run ${fmtNum(runs)} times` : m === "moderation" ? "Baseline 1" : "Baseline 2"}
                  </p>
                </div>
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground/85">{SEES[m]}</p>
              <div
                className={cn(
                  "mt-5 flex justify-center rounded-xl bg-background/60 px-3 py-3.5",
                  nl ? "text-primary" : "text-muted-foreground",
                )}
              >
                <ScopeGlyph method={m} />
              </div>
              <dl className="divide-y divide-border pt-4">
                <MethodScoreRow label="Planted signals caught" value={scoreText(h.signalsCaught[m])} />
                <MethodScoreRow label="Patterns found" value={scoreText(h.patternsFound[m])} />
                <MethodScoreRow label="False alarms, talk soon or urgent" value={fmtNum(h.falseAlarms[m].talkSoonOrUrgent)} />
              </dl>
            </article>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
