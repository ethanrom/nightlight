"use client";

import { useMemo, useState } from "react";
import { Check, Globe, MessageSquare, PartyPopper } from "lucide-react";
import { EvidenceChip } from "@/components/report/evidence";
import { useReport } from "@/components/report/report-context";
import { SeverityDot } from "@/components/severity";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDateTime } from "@/lib/format";
import { DIMENSION_BY_ID, SEVERITY_META, severityRank, type DimensionId, type Severity } from "@/lib/rubric";
import { SEVERITY_STYLE, collectFindings, coveredRefs, DIMENSION_ICON, type Finding } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

type SevFilter = "all" | Exclude<Severity, "normal">;
const SEV_FILTERS: { id: SevFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "worth_noticing", label: "Worth noticing" },
  { id: "talk_soon", label: "Talk soon" },
  { id: "urgent", label: "Urgent" },
];

function FindingRow({ f }: { f: Finding }) {
  return (
    <li className="flex flex-col gap-2.5 py-3.5 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 flex-1 gap-3">
        <span className="mt-1.5">
          <SeverityDot severity={f.severity} className="size-2.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-foreground/90">{f.text}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            {f.origin === "history" ? <Globe className="size-3" /> : <MessageSquare className="size-3" />}
            <span>{f.where}</span>
            {f.when && <span className="tabular-nums">· {fmtDateTime(f.when)}</span>}
            <span className={cn("font-medium", SEVERITY_STYLE[f.severity].ink)}>· {SEVERITY_META[f.severity].label}</span>
          </p>
        </div>
      </div>
      <EvidenceChip refStr={f.ref} className="self-start sm:mt-0.5" />
    </li>
  );
}

export function OtherNotices() {
  const { report } = useReport();
  const [sev, setSev] = useState<SevFilter>("all");
  const [dim, setDim] = useState<string>("all");

  const { others, normals } = useMemo(() => {
    const all = collectFindings(report);
    const covered = coveredRefs(report);
    return {
      others: all.filter((f) => !f.normal && !covered.has(f.ref)),
      normals: all.filter((f) => f.normal),
    };
  }, [report]);

  const dimOptions = useMemo(() => {
    const ids = [...new Set(others.map((f) => f.dimension))];
    return [
      { value: "all", label: "All areas" },
      ...ids.map((id) => ({ value: id, label: DIMENSION_BY_ID[id].label })),
    ];
  }, [others]);

  const filtered = others.filter((f) => (sev === "all" || f.severity === sev) && (dim === "all" || f.dimension === dim));

  const groups = useMemo(() => {
    const m = new Map<DimensionId, Finding[]>();
    for (const f of filtered) m.set(f.dimension, [...(m.get(f.dimension) ?? []), f]);
    return [...m.entries()]
      .map(([id, list]) => ({
        id,
        list: [...list].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || (b.when ?? 0) - (a.when ?? 0)),
      }))
      .sort(
        (a, b) =>
          severityRank(b.list[0].severity) - severityRank(a.list[0].severity) ||
          DIMENSION_BY_ID[a.id].label.localeCompare(DIMENSION_BY_ID[b.id].label),
      );
  }, [filtered]);

  return (
    <div className="space-y-8">
      <section aria-labelledby="other-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 id="other-title" className="text-title text-xl">
              Other things we noticed
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Smaller signals that aren’t part of the main concerns above. {others.length} in total.
            </p>
          </div>
          {others.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5 print:hidden">
              <div role="group" aria-label="Filter by severity" className="flex gap-1 rounded-full bg-muted p-1">
                {SEV_FILTERS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={sev === s.id}
                    onClick={() => setSev(s.id)}
                    className={cn(
                      "h-7 rounded-full px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      sev === s.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <Select
                items={dimOptions}
                value={dim}
                onValueChange={(v) => setDim(v ?? "all")}
              >
                <SelectTrigger className="h-9 w-48 rounded-full" aria-label="Filter by area">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} align="end" className="min-w-56">
                  {dimOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {others.length === 0 ? (
          <p className="nl-card mt-5 p-6 text-center text-sm text-muted-foreground">
            Nothing else came up beyond the concerns above.
          </p>
        ) : groups.length === 0 ? (
          <p className="nl-card mt-5 p-6 text-center text-sm text-muted-foreground">Nothing matches those filters.</p>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {groups.map((g) => {
              const Icon = DIMENSION_ICON[g.id];
              return (
                <div key={g.id} className="nl-card p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold">{DIMENSION_BY_ID[g.id].label}</h4>
                      <p className="text-xs text-muted-foreground">{g.list.length} {g.list.length === 1 ? "signal" : "signals"}</p>
                    </div>
                  </div>
                  <ul className="mt-2 divide-y divide-border">
                    {g.list.map((f) => (
                      <FindingRow key={f.key} f={f} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {normals.length > 0 && (
        <section
          aria-labelledby="normal-title"
          className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-[color-mix(in_oklab,var(--sev-normal)_30%,var(--border))] bg-sev-normal-soft/60 p-5 sm:p-7"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-sev-normal-soft text-sev-normal-ink">
              <PartyPopper className="size-5" />
            </span>
            <div>
              <h3 id="normal-title" className="text-title text-lg">
                Normal for their age
              </h3>
              <p className="text-sm text-muted-foreground">
                Healthy, expected parts of growing up. No action needed. We list them so you can see they weren’t missed.
              </p>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-[color-mix(in_oklab,var(--sev-normal)_20%,transparent)]">
            {normals.map((f) => (
              <li key={f.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-sev-normal-ink" />
                  <p className="text-sm leading-relaxed text-foreground/90">{f.text}</p>
                </div>
                <EvidenceChip refStr={f.ref} className="self-start" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
