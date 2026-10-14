"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Clock, Eye, EyeOff, Globe, Lock, MessageSquare, Moon, Search, ShieldQuestion } from "lucide-react";
import { Blurred } from "@/components/report/blur";
import { ChatBubble } from "@/components/report/chat-bubble";
import { useReport } from "@/components/report/report-context";
import { DimensionBadge, SeverityChip } from "@/components/severity";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtDate, fmtDateTime, plural } from "@/lib/format";
import type { DimensionId, Severity } from "@/lib/rubric";
import { maxSeverity, parseEvidenceRef } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";
import type { HistoryItem, Report } from "@/lib/types";

// ------------------------------------------------------------------ resolve refs

export function resolveHistory(report: Report, id: number) {
  const item = report.historyItems.find((i) => i.id === id);
  if (!item) return null;
  const flags = report.historyFlags.filter((f) => f.id === id);
  return { item, flags };
}

export function resolveChat(report: Report, convId: string, index: number) {
  const conv = report.conversations.find((c) => c.id === convId);
  if (!conv) return null;
  const audit = report.chatAudits.find((a) => a.id === convId);
  const flags = audit?.flags.filter((f) => f.message_index === index) ?? [];
  return { conv, audit, flags, index };
}

// ------------------------------------------------------------------ context

interface EvidenceCtx {
  openEvidence: (ref: string) => void;
}
const Ctx = createContext<EvidenceCtx | null>(null);

export function useEvidence(): EvidenceCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEvidence must be used inside <EvidenceProvider>");
  return v;
}

export function EvidenceProvider({ children }: { children: React.ReactNode }) {
  const [ref, setRef] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const openEvidence = useCallback((r: string) => {
    setRevealed(false);
    setRef(r);
  }, []);
  const value = useMemo(() => ({ openEvidence }), [openEvidence]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <EvidenceDialog
        refStr={ref}
        revealed={revealed}
        onToggle={() => setRevealed((v) => !v)}
        onClose={() => setRef(null)}
      />
    </Ctx.Provider>
  );
}

// ------------------------------------------------------------------ chip

export function EvidenceChip({ refStr, className }: { refStr: string; className?: string }) {
  const { report } = useReport();
  const { openEvidence } = useEvidence();
  const parsed = parseEvidenceRef(refStr);

  let label = "Evidence";
  let Icon = Eye;
  let found = false;
  if (parsed?.type === "history") {
    const r = resolveHistory(report, parsed.id);
    if (r) {
      found = true;
      Icon = r.item.search ? Search : Globe;
      label = `${r.item.search ? "Search" : "Page"} · ${fmtDate(r.item.lastSeen)}`;
    }
  } else if (parsed?.type === "chat") {
    const r = resolveChat(report, parsed.convId, parsed.index);
    if (r) {
      found = true;
      Icon = MessageSquare;
      label = `${r.conv.platform} · message ${parsed.index + 1}`;
    }
  }

  return (
    <button
      type="button"
      disabled={!found}
      onClick={() => openEvidence(refStr)}
      title={found ? "Open the evidence (blurred until you reveal it)" : "This evidence is no longer available"}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-xs font-medium text-foreground/80 transition-colors outline-none",
        "hover:border-primary/40 hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <Icon className="size-3.5" />
      {label}
      <Lock className="size-3 text-muted-foreground" />
    </button>
  );
}

// ------------------------------------------------------------------ dialog

function EvidenceDialog({
  refStr,
  revealed,
  onToggle,
  onClose,
}: {
  refStr: string | null;
  revealed: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { report, name } = useReport();
  const parsed = refStr ? parseEvidenceRef(refStr) : null;

  return (
    <Dialog open={!!refStr} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden p-0 sm:max-w-xl">
        {parsed?.type === "history" && <HistoryEvidence id={parsed.id} report={report} revealed={revealed} />}
        {parsed?.type === "chat" && (
          <ChatEvidence convId={parsed.convId} index={parsed.index} report={report} revealed={revealed} name={name} onReveal={onToggle} />
        )}
        {!parsed && refStr && <Missing />}
        {parsed && (
          <DialogFooter className="mx-0 mb-0 items-center justify-between sm:justify-between">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" />
              {revealed ? "Revealed. Close this window to hide it again." : "Blurred by default. Only you decide."}
            </p>
            <Button onClick={onToggle} variant={revealed ? "outline" : "default"} className="rounded-full">
              {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {revealed ? "Hide again" : "Reveal evidence"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Missing() {
  return (
    <div className="p-6">
      <DialogHeader>
        <DialogTitle>Evidence unavailable</DialogTitle>
        <DialogDescription>This reference points at something that is no longer in the report.</DialogDescription>
      </DialogHeader>
      <ShieldQuestion className="mt-4 size-8 text-muted-foreground" />
    </div>
  );
}

function FlagSummary({
  flags,
}: {
  flags: { dimension: DimensionId; severity: Severity; text: string }[];
}) {
  if (!flags.length) return null;
  return (
    <div className="space-y-2.5">
      {flags.map((f, i) => (
        <div key={i} className="rounded-xl bg-muted/70 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityChip severity={f.severity} />
            <DimensionBadge id={f.dimension} full />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{f.text}</p>
        </div>
      ))}
    </div>
  );
}

function HistoryEvidence({ id, report, revealed }: { id: number; report: Report; revealed: boolean }) {
  const r = resolveHistory(report, id);
  const sorted = useMemo(() => [...report.historyItems].sort((a, b) => a.lastSeen - b.lastSeen), [report.historyItems]);
  if (!r) return <Missing />;
  const idx = sorted.findIndex((i) => i.id === id);
  const near = [...sorted.slice(Math.max(0, idx - 2), idx), ...sorted.slice(idx + 1, idx + 3)];
  const { item } = r;

  return (
    <div className="flex max-h-[calc(88vh-4.5rem)] flex-col overflow-y-auto">
      <div className="p-5 pb-4 sm:p-6 sm:pb-4">
        <DialogHeader>
          <DialogTitle className="text-lg">{item.search ? "A search" : "A page"} from the browsing history</DialogTitle>
          <DialogDescription>Shown with the pages around it, so you can see the context.</DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <FlagSummary flags={r.flags.map((f) => ({ dimension: f.dimension, severity: f.severity, text: f.reason }))} />
        </div>
        <HistoryRow item={item} revealed={revealed} emphasised />
        <p className="eyebrow mt-6 mb-2.5">Around the same time</p>
        <ul className="space-y-2">
          {near.map((n) => (
            <li key={n.id}>
              <HistoryRow item={n} revealed={revealed} />
            </li>
          ))}
          {near.length === 0 && <li className="text-sm text-muted-foreground">No nearby pages.</li>}
        </ul>
      </div>
    </div>
  );
}

function HistoryRow({ item, revealed, emphasised }: { item: HistoryItem; revealed: boolean; emphasised?: boolean }) {
  return (
    <div className={cn("mt-4 rounded-xl border p-3.5", emphasised ? "border-primary/30 bg-accent/50" : "mt-0 border-border bg-card")}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          {item.search ? <Search className="size-4" /> : <Globe className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <Blurred revealed={revealed} as="p" className="block truncate text-sm font-medium">
            {item.search ? `“${item.search}”` : item.title}
          </Blurred>
          <Blurred revealed={revealed} as="p" className="mt-0.5 block truncate text-xs text-muted-foreground">
            {item.domain}
            {item.path !== "/search" ? item.path : ""}
          </Blurred>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> {fmtDateTime(item.lastSeen)}
            </span>
            <span>{plural(item.visits, "visit")}</span>
            {item.lateNight > 0 && (
              <span className="inline-flex items-center gap-1 text-[var(--glow-ink)]">
                <Moon className="size-3" /> {item.lateNight} after midnight
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatEvidence({
  convId,
  index,
  report,
  revealed,
  name,
  onReveal,
}: {
  convId: string;
  index: number;
  report: Report;
  revealed: boolean;
  name: string;
  onReveal: () => void;
}) {
  const r = resolveChat(report, convId, index);
  if (!r) return <Missing />;
  const { conv, flags } = r;
  const from = Math.max(0, index - 2);
  const msgs = conv.messages.slice(from, index + 3);
  const top = maxSeverity(flags.map((f) => f.severity)) ?? undefined;

  return (
    <div className="flex max-h-[calc(88vh-4.5rem)] flex-col overflow-y-auto">
      <div className="p-5 pb-4 sm:p-6 sm:pb-4">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {conv.platform}: {conv.title}
          </DialogTitle>
          <DialogDescription>
            {conv.startedAt ? fmtDateTime(conv.startedAt) : "Date unknown"} · message {index + 1} of {conv.messages.length}, with
            the messages around it.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <FlagSummary flags={flags.map((f) => ({ dimension: f.dimension, severity: f.severity, text: f.explanation }))} />
        </div>
        <div className="mt-5 space-y-4 rounded-2xl bg-background/60 p-4 ring-1 ring-border">
          {from > 0 && <p className="text-center text-xs text-muted-foreground">Earlier messages not shown</p>}
          {msgs.map((m) => (
            <ChatBubble
              key={m.i}
              message={m}
              revealed={revealed}
              onRevealRequest={onReveal}
              childName={name}
              flagSeverity={m.i === index ? top : undefined}
            />
          ))}
          {from + msgs.length < conv.messages.length && (
            <p className="text-center text-xs text-muted-foreground">Later messages not shown</p>
          )}
        </div>
        {conv.truncated && (
          <p className="mt-3 text-xs text-muted-foreground">This conversation was shortened to fit the analysis budget.</p>
        )}
      </div>
    </div>
  );
}
