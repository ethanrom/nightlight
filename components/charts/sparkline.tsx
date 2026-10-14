import { cn } from "@/lib/utils";

/**
 * Tiny trend line. Context in the de-emphasis grey, the most recent stretch and the end dot in the accent.
 * Pure SVG (no chart library) so it costs nothing and prints cleanly.
 */
export function Sparkline({
  values,
  accent = "var(--chart-1)",
  className,
  label,
  points = 14,
}: {
  values: number[];
  accent?: string;
  className?: string;
  label?: string;
  points?: number;
}) {
  const W = 120;
  const H = 36;
  const pad = 5;
  const v = values.slice(-points);
  if (v.length < 2) return <div className={cn("h-9", className)} aria-hidden />;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  const xy = v.map((n, i) => {
    const x = pad + (i / (v.length - 1)) * (W - pad * 2);
    const y = max === min ? H / 2 : pad + (1 - (n - min) / span) * (H - pad * 2);
    return [x, y] as const;
  });
  const path = (pts: readonly (readonly [number, number])[]) =>
    pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const tail = xy.slice(-Math.max(2, Math.ceil(v.length / 3)));
  const [ex, ey] = xy[xy.length - 1];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-9 w-full", className)}
      fill="none"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      preserveAspectRatio="none"
    >
      <path d={path(xy)} stroke="var(--chart-muted)" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path d={path(tail)} stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={ex} cy={ey} r="4" fill={accent} stroke="var(--card)" strokeWidth="2" />
    </svg>
  );
}
