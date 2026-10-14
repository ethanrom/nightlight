"use client";

import { useMemo, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import { ConversationCard } from "@/components/report/chats/conversation-card";
import { ConversationSheet } from "@/components/report/chats/conversation-sheet";
import { MoodChart } from "@/components/report/chats/mood-chart";
import { AiAppsCard, AiReportCard, RelianceMeter } from "@/components/report/chats/reliance-and-apps";
import { useReport } from "@/components/report/report-context";
import { isLateNight } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "all" | "flagged" | "late" | "notok";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "flagged", label: "Flagged" },
  { id: "late", label: "After midnight" },
  { id: "notok", label: "AI not OK for a child" },
];

export function ChatsTab() {
  const { report } = useReport();
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const audits = useMemo(() => new Map(report.chatAudits.map((a) => [a.id, a])), [report.chatAudits]);
  const sorted = useMemo(
    () => [...report.conversations].sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0)),
    [report.conversations],
  );
  const filtered = sorted.filter((c) => {
    const a = audits.get(c.id);
    switch (filter) {
      case "flagged":
        return !!a?.flags.some((f) => !f.developmentally_normal && f.severity !== "normal");
      case "late":
        return c.startedAt ? isLateNight(c.startedAt) : false;
      case "notok":
        return a?.ai_response.grade === "inappropriate_for_a_child";
      default:
        return true;
    }
  });
  const open = report.conversations.find((c) => c.id === openId) ?? null;

  if (report.conversations.length === 0) {
    return (
      <div className="nl-card flex flex-col items-center gap-3 p-12 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <MessagesSquare className="size-5" />
        </span>
        <p className="text-lg font-medium">No AI chats in this analysis</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Add a ChatGPT or Claude export, or paste a Character.AI or Snapchat My AI transcript, to see mood over time, reliance
          and how the AI responded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MoodChart />
        </div>
        <div className="space-y-5">
          <RelianceMeter />
          {report.summary?.ai_usage_insight && (
            <section className="nl-card p-5 sm:p-6">
              <p className="eyebrow">How they use AI</p>
              <p className="mt-2.5 text-sm leading-relaxed text-foreground/85">{report.summary.ai_usage_insight}</p>
            </section>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <AiAppsCard />
        <AiReportCard />
      </div>

      <section aria-labelledby="convs-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="convs-title" className="text-title text-xl">
              Conversations
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtered.length} of {sorted.length} shown, newest first. Messages stay blurred until you open one.
            </p>
          </div>
          <div role="group" aria-label="Filter conversations" className="flex flex-wrap gap-1 rounded-full bg-muted p-1 print:hidden">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "h-7 rounded-full px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  filter === f.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className="nl-card p-8 text-center text-sm text-muted-foreground">No conversations match that filter.</p>
        ) : (
          <Stagger key={filter} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" gap={0.05}>
            {filtered.map((c) => (
              <StaggerItem key={c.id}>
                <ConversationCard conv={c} audit={audits.get(c.id)} onOpen={() => setOpenId(c.id)} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      <ConversationSheet conv={open} audit={open ? audits.get(open.id) : undefined} open={!!open} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}
