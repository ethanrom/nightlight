"use client";

import { useMemo, useState } from "react";
import { AtSign, Eye, EyeOff, Mail, MapPin, Phone, School, Search, ShieldCheck } from "lucide-react";
import { Blurred } from "@/components/report/blur";
import { EvidenceChip } from "@/components/report/evidence";
import { useReport } from "@/components/report/report-context";
import { DimensionBadge, SeverityDot } from "@/components/severity";
import { Button } from "@/components/ui/button";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { DIMENSION_BY_ID, severityRank } from "@/lib/rubric";
import type { PiiType } from "@/lib/types";

// ------------------------------------------------------------------ search terms

export function SearchTerms() {
  const { report } = useReport();
  const [open, setOpen] = useState<Set<number>>(new Set());

  const flagged = useMemo(() => {
    const byId = new Map(report.historyItems.map((i) => [i.id, i]));
    return report.historyFlags
      .map((f) => ({ f, item: byId.get(f.id) }))
      .filter((x): x is { f: typeof x.f; item: NonNullable<typeof x.item> } => !!x.item?.search && !x.f.developmentally_normal)
      .sort((a, b) => severityRank(b.f.severity) - severityRank(a.f.severity) || b.item.lastSeen - a.item.lastSeen);
  }, [report]);

  const total = report.stats.searchCount;
  const rest = Math.max(0, total - flagged.length);

  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="nl-card h-full p-5 sm:p-6" aria-labelledby="search-title">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Search className="size-4" />
        </span>
        <div>
          <h3 id="search-title" className="text-title text-lg">
            Search terms
          </h3>
          <p className="text-xs text-muted-foreground">Flagged searches stay blurred until you reveal them</p>
        </div>
      </div>

      <div className="mt-5 flex items-baseline gap-3">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{fmtNum(flagged.length)}</p>
        <p className="text-sm text-muted-foreground">of {fmtNum(total)} searches flagged</p>
      </div>

      {flagged.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {flagged.map(({ f, item }) => {
            const revealed = open.has(item.id);
            return (
              <li key={`${item.id}-${f.dimension}`} className="flex items-center gap-3 py-3">
                <SeverityDot severity={f.severity} className="size-2.5" />
                <div className="min-w-0 flex-1">
                  <Blurred revealed={revealed} as="p" className="block truncate text-sm font-medium">
                    “{item.search}”
                  </Blurred>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular-nums">
                    {fmtDateTime(item.lastSeen)}
                    <DimensionBadge id={f.dimension} className="h-5 text-[0.68rem]" />
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full print:hidden"
                  aria-label={revealed ? "Hide this search" : "Reveal this search"}
                  aria-pressed={revealed}
                  onClick={() => toggle(item.id)}
                >
                  {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{fmtNum(rest)}</span> other searches looked ordinary and are
        not shown.
      </p>
    </section>
  );
}

// ------------------------------------------------------------------ personal info shared

const PII_META: Record<PiiType, { label: string; icon: typeof School }> = {
  school: { label: "School name", icon: School },
  address: { label: "Home address", icon: MapPin },
  email: { label: "Email address", icon: Mail },
  phone: { label: "Phone number", icon: Phone },
  social_handle: { label: "Social media handle", icon: AtSign },
};

export function PiiCards() {
  const { report } = useReport();
  const convs = useMemo(() => new Map(report.conversations.map((c) => [c.id, c])), [report.conversations]);

  return (
    <section className="nl-card p-5 sm:p-6" aria-labelledby="pii-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground">
            <ShieldCheck className="size-4" />
          </span>
          <div>
            <h3 id="pii-title" className="text-title text-lg">
              Personal details shared
            </h3>
            <p className="text-xs text-muted-foreground">
              Found in chats, masked on your device before anything was analysed
            </p>
          </div>
        </div>
        <DimensionBadge id="personal_info" full />
      </div>

      {report.pii.length === 0 ? (
        <p className="mt-6 rounded-xl bg-sev-normal-soft px-4 py-3.5 text-sm text-sev-normal-ink">
          No names, schools, addresses or contact details were shared in the chats we saw.
        </p>
      ) : (
        <>
          <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {report.pii.map((p, i) => {
              const meta = PII_META[p.type];
              const conv = convs.get(p.conversationId);
              return (
                <li key={`${p.conversationId}-${p.messageIndex}-${i}`} className="rounded-2xl border border-border bg-background/50 p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
                      <meta.icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{meta.label}</p>
                      <p className="truncate font-mono text-sm font-medium">{p.preview}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Shared in {conv ? `${conv.platform}: “${conv.title}”` : "a chat"}
                    {conv?.startedAt ? ` on ${fmtDateTime(conv.startedAt)}` : ""}.
                  </p>
                  <div className="mt-3">
                    <EvidenceChip refStr={`c:${p.conversationId}:${p.messageIndex}`} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            What we watch for: {DIMENSION_BY_ID.personal_info.description.charAt(0).toLowerCase() + DIMENSION_BY_ID.personal_info.description.slice(1)}
          </p>
        </>
      )}
    </section>
  );
}
