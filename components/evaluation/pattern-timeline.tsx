"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DAY,
  HOUR,
  LANES,
  LANE_META,
  MINUTE,
  fmtWallDay,
  fmtWallDayTime,
  fmtWallTime,
  wallMs,
} from "@/components/evaluation/eval-utils";
import type { EvalPattern, EvalSignal, PatternEvidence } from "@/lib/eval-types";
import { cn } from "@/lib/utils";

const LANE_H = 72;
const AXIS_H = 30;
const PAD_X = 20;
/** Vertical nudges for dots in the same lane that would otherwise overlap. */
const SLOTS = [0, -23, 23];
const MIN_GAP = 24;

export interface TimelineItem extends PatternEvidence {
  ms: number;
  /** 1-based position in time order, shown inside the dot */
  n: number;
  detail?: string;
}

/** Evidence in time order, joined to its signal so the tooltip can show where it was found. */
export function buildTimelineItems(pattern: EvalPattern, signals: EvalSignal[]): TimelineItem[] {
  const byId = new Map(signals.map((s) => [s.id, s]));
  return [...pattern.evidence]
    .map((e) => ({ ...e, ms: wallMs(e.date) }))
    .sort((a, b) => a.ms - b.ms)
    .map((e, i) => ({ ...e, n: i + 1, detail: byId.get(e.signalId)?.sourceDetail }));
}

function useWidth(initial = 720) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** The time range to draw: the pattern's span, widened to include its evidence, or zoomed in when it is a single day. */
function buildDomain(pattern: EvalPattern, items: TimelineItem[]) {
  const spanLo = Math.floor(wallMs(pattern.span.from) / DAY) * DAY;
  const spanHi = Math.floor(wallMs(pattern.span.to) / DAY) * DAY + DAY;
  if (items.length === 0) return { lo: spanLo, hi: Math.max(spanHi, spanLo + DAY) };
  const eLo = items[0].ms;
  const eHi = items[items.length - 1].ms;
  let lo = Math.min(spanLo, eLo);
  let hi = Math.max(spanHi, eHi);
  if (hi - lo <= 36 * HOUR) {
    const pad = Math.max(30 * MINUTE, (eHi - eLo) * 0.3);
    lo = eLo - pad;
    hi = eHi + pad;
    if (hi - lo < 2 * HOUR) {
      const mid = (lo + hi) / 2;
      lo = mid - HOUR;
      hi = mid + HOUR;
    }
  }
  return { lo, hi };
}

const STEPS = [10 * MINUTE, 15 * MINUTE, 30 * MINUTE, HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 7 * DAY, 14 * DAY];

function xOf(ms: number, lo: number, hi: number, width: number) {
  return PAD_X + ((ms - lo) / (hi - lo)) * Math.max(1, width - PAD_X * 2);
}

function buildTicks(lo: number, hi: number, maxTicks: number) {
  const step = STEPS.find((s) => (hi - lo) / s <= maxTicks) ?? STEPS[STEPS.length - 1];
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
  return { ticks, step };
}

export function PatternTimeline({
  pattern,
  items,
  active,
  onActive,
}: {
  pattern: EvalPattern;
  items: TimelineItem[];
  active: number | null;
  onActive: (n: number | null) => void;
}) {
  const [ref, width] = useWidth();
  const { lo, hi } = useMemo(() => buildDomain(pattern, items), [pattern, items]);
  const { ticks, step } = useMemo(() => buildTicks(lo, hi, Math.max(2, Math.floor(width / 66))), [lo, hi, width]);

  const x = (ms: number) => xOf(ms, lo, hi, width);

  // Position every dot; nudge neighbours in the same lane apart vertically.
  const dots = useMemo(() => {
    const placed: { item: TimelineItem; cx: number; cy: number; lane: number }[] = [];
    for (const item of items) {
      const lane = Math.max(0, LANES.indexOf(item.lane));
      const cx = xOf(item.ms, lo, hi, width);
      const taken = new Set(
        placed.filter((p) => p.lane === lane && Math.abs(p.cx - cx) < MIN_GAP).map((p) => p.cy - (lane * LANE_H + LANE_H / 2)),
      );
      const offset = SLOTS.find((o) => !taken.has(o)) ?? 0;
      placed.push({ item, cx, cy: lane * LANE_H + LANE_H / 2 + offset, lane });
    }
    return placed;
  }, [items, lo, hi, width]);

  const activeDot = dots.find((d) => d.item.n === active);
  const plotH = LANES.length * LANE_H;

  return (
    <div className="flex" role="group" aria-label={`Timeline of the evidence for ${pattern.title}`}>
      {/* lane labels */}
      <div className="w-9 shrink-0 sm:w-[7.5rem]" aria-hidden>
        {LANES.map((l) => {
          const Icon = LANE_META[l].icon;
          return (
            <div key={l} className="flex items-center gap-2 text-xs font-medium text-muted-foreground" style={{ height: LANE_H }}>
              <Icon className="size-4 shrink-0" />
              <span className="hidden sm:inline">{LANE_META[l].label}</span>
            </div>
          );
        })}
      </div>

      {/* plot */}
      <div ref={ref} className="relative min-w-0 flex-1" style={{ height: plotH + AXIS_H }}>
        {LANES.map((l, i) => (
          <div
            key={l}
            aria-hidden
            className={cn("absolute inset-x-0 rounded-lg", i % 2 === 0 ? "bg-foreground/[0.045]" : "bg-transparent")}
            style={{ top: i * LANE_H, height: LANE_H }}
          />
        ))}
        {ticks.map((t) => (
          <div key={t} aria-hidden>
            <div className="absolute w-px" style={{ left: x(t), top: 0, height: plotH, background: "var(--chart-grid)" }} />
            <span
              className="absolute -translate-x-1/2 text-[0.7rem] whitespace-nowrap text-[var(--chart-muted)] tabular-nums"
              style={{ left: x(t), top: plotH + 8 }}
            >
              {step < DAY ? fmtWallTime(t) : fmtWallDay(t)}
            </span>
          </div>
        ))}

        {/* the line that links the evidence in time order */}
        <svg aria-hidden className="pointer-events-none absolute top-0 left-0" width={width} height={plotH}>
          {dots.length > 1 && (
            <polyline
              points={dots.map((d) => `${d.cx},${d.cy}`).join(" ")}
              fill="none"
              stroke="var(--chart-1)"
              strokeOpacity={0.4}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {dots.map(({ item, cx, cy }, i) => {
          const isActive = active === item.n;
          return (
            <button
              key={`${item.signalId}-${item.n}`}
              type="button"
              aria-label={`${item.n}. ${item.label}. ${LANE_META[item.lane].label}, ${fmtWallDayTime(item.ms)}`}
              aria-pressed={isActive}
              onPointerEnter={() => onActive(item.n)}
              onPointerLeave={() => onActive(null)}
              onFocus={() => onActive(item.n)}
              onBlur={() => onActive(null)}
              onClick={() => onActive(isActive ? null : item.n)}
              className="absolute z-10 grid size-8 -translate-x-1/2 -translate-y-1/2 animate-in place-items-center rounded-full outline-none duration-500 fade-in-0 zoom-in-50 fill-mode-backwards focus-visible:ring-3 focus-visible:ring-ring/60"
              style={{ left: cx, top: cy, animationDelay: `${120 + i * 70}ms` }}
            >
              <span
                className={cn(
                  "grid size-[1.35rem] place-items-center rounded-full bg-primary text-[0.68rem] font-semibold text-primary-foreground tabular-nums ring-2 ring-card transition-transform duration-150",
                  isActive && "scale-125 ring-4 ring-primary/25",
                )}
              >
                {item.n}
              </span>
            </button>
          );
        })}

        {activeDot && (
          <div
            role="presentation"
            className="pointer-events-none absolute z-20 w-60 rounded-xl border border-border bg-popover px-3.5 py-3 text-popover-foreground shadow-lg"
            style={{
              left: Math.min(Math.max(activeDot.cx, 126), Math.max(126, width - 126)),
              top: activeDot.lane === 0 ? activeDot.cy + 22 : activeDot.cy - 22,
              transform: activeDot.lane === 0 ? "translateX(-50%)" : "translate(-50%, -100%)",
            }}
          >
            <p className="text-sm leading-snug font-semibold text-pretty">{activeDot.item.label}</p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {LANE_META[activeDot.item.lane].label} · {fmtWallDayTime(activeDot.item.ms)}
            </p>
            {activeDot.item.detail && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{activeDot.item.detail}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
