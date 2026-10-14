"use client";

import { Check, Eye, HeartPulse, MessageCircleHeart } from "lucide-react";
import { motion } from "motion/react";
import { EASE } from "@/components/motion";
import { useReport } from "@/components/report/report-context";
import { fmtDateRange, fmtNum, plural } from "@/lib/format";
import { OVERALL_META, type OverallLevel } from "@/lib/rubric";
import { OVERALL_ORDER, OVERALL_SEVERITY, SEVERITY_STYLE } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

const LEVEL_ICON = {
  all_clear: Check,
  keep_an_eye: Eye,
  talk_soon: MessageCircleHeart,
  act_now: HeartPulse,
} as const;

function Orb({ level }: { level: OverallLevel }) {
  const Icon = LEVEL_ICON[level];
  const color = SEVERITY_STYLE[OVERALL_SEVERITY[level]].cssVar;
  return (
    <div
      className="relative grid size-40 shrink-0 place-items-center sm:size-44"
      style={{ ["--c" as string]: color }}
      aria-hidden
    >
      {/* outer pulses */}
      <span className="absolute inset-0 animate-nl-glow rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--c)_38%,transparent),transparent_68%)]" />
      <span className="absolute inset-3 rounded-full border border-[color-mix(in_oklab,var(--c)_30%,transparent)]" />
      <span className="absolute inset-7 rounded-full border border-[color-mix(in_oklab,var(--c)_22%,transparent)]" />
      <motion.span
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative grid size-[5.5rem] place-items-center rounded-full text-white shadow-[0_0_60px_8px_color-mix(in_oklab,var(--c)_50%,transparent)] sm:size-24"
        style={{
          background:
            "radial-gradient(circle at 32% 26%, color-mix(in oklab, var(--c) 45%, white), var(--c) 55%, color-mix(in oklab, var(--c) 72%, black))",
        }}
      >
        <Icon className="size-9 drop-shadow-sm" strokeWidth={1.75} />
      </motion.span>
    </div>
  );
}

export function StatusHero() {
  const { report, name } = useReport();
  const s = report.summary;
  if (!s) return null;
  const level = s.overall;
  const sev = SEVERITY_STYLE[OVERALL_SEVERITY[level]];
  const idx = OVERALL_ORDER.indexOf(level);

  return (
    <section
      className="nl-card relative overflow-hidden p-6 sm:p-9"
      aria-label="Overall status"
      style={{ ["--c" as string]: sev.cssVar }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 size-[420px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--c)_16%,transparent),transparent_66%)]"
      />
      <div className="relative grid items-center gap-8 md:grid-cols-[auto_1fr] md:gap-12">
        <div className="mx-auto md:mx-0">
          <Orb level={level} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={cn("inline-flex h-7 items-center gap-2 rounded-full px-3 text-sm font-semibold", sev.chip)}>
              <span className={cn("size-2 rounded-full", sev.dot)} />
              {OVERALL_META[level].label}
            </span>
            <span className="text-sm text-muted-foreground">{OVERALL_META[level].blurb}</span>
          </div>
          <h2 className="text-display mt-4 text-[1.75rem] text-balance sm:text-[2.2rem]">{s.headline}</h2>
          <p className="mt-4 max-w-3xl text-[0.97rem] leading-relaxed text-pretty text-foreground/80">{s.summary}</p>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <ol className="flex items-center gap-1.5" aria-label={`Level ${idx + 1} of ${OVERALL_ORDER.length}`}>
              {OVERALL_ORDER.map((l, i) => (
                <li key={l} className="flex items-center gap-1.5" title={OVERALL_META[l].label}>
                  <span
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === idx ? "w-10" : "w-6",
                      i <= idx ? SEVERITY_STYLE[OVERALL_SEVERITY[l]].bar : "bg-muted",
                      i > idx && "opacity-80",
                    )}
                  />
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground tabular-nums">
              {name === "Your child" ? "Based on" : `${name}’s report is based on`} {plural(report.stats.analysed.historyItems, "page")},{" "}
              {plural(report.stats.conversations, "conversation")}, {fmtDateRange(report.stats.range)}
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            A conversation aid, not a diagnosis.{" "}
            {report.stats.totalVisits > 0 && <span className="tabular-nums">{fmtNum(report.stats.totalVisits)} visits read in total.</span>}
          </p>
        </div>
      </div>
    </section>
  );
}
