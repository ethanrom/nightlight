"use client";

import { useState } from "react";
import { Eye, EyeOff, Moon } from "lucide-react";
import { ChatBubble } from "@/components/report/chat-bubble";
import { useReport } from "@/components/report/report-context";
import { GradeBadge } from "@/components/severity";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { fmtDateTime, isLateNight } from "@/lib/format";
import { maxSeverity } from "@/lib/ui-meta";
import type { ChatAudit, PreparedConversation } from "@/lib/types";

function SheetBody({ conv, audit }: { conv: PreparedConversation; audit?: ChatAudit }) {
  const { name } = useReport();
  const [revealed, setRevealed] = useState(false);
  const late = conv.startedAt ? isLateNight(conv.startedAt) : false;

  return (
    <>
      <SheetHeader className="gap-1.5 border-b border-border p-5 pr-14">
        <SheetTitle className="text-lg leading-snug">{conv.title}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-x-2.5 gap-y-1 tabular-nums">
          <span>{conv.platform}</span>
          {conv.startedAt && <span>· {fmtDateTime(conv.startedAt)}</span>}
          {late && (
            <span className="inline-flex items-center gap-1 text-[var(--glow-ink)]">
              <Moon className="size-3" /> after midnight
            </span>
          )}
        </SheetDescription>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-muted/70 px-3.5 py-2.5 text-sm">
          <span className="flex items-center gap-2">
            {revealed ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            <span>
              <span className="font-medium">Reveal messages</span>
              <span className="block text-xs text-muted-foreground">Blurred by default. You choose.</span>
            </span>
          </span>
          <Switch checked={revealed} onCheckedChange={setRevealed} aria-label="Reveal messages" />
        </label>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {conv.messages.map((m) => {
          const flags = audit?.flags.filter((f) => f.message_index === m.i && f.severity !== "normal") ?? [];
          const sev = maxSeverity(flags.map((f) => f.severity)) ?? undefined;
          return (
            <ChatBubble
              key={m.i}
              message={m}
              revealed={revealed}
              onRevealRequest={() => setRevealed(true)}
              childName={name}
              flagSeverity={sev}
              flagNote={flags[0]?.explanation}
            />
          );
        })}
        {conv.truncated && (
          <p className="text-center text-xs text-muted-foreground">Long messages were shortened to fit the analysis budget.</p>
        )}
      </div>

      {audit && (
        <div className="border-t border-border bg-muted/40 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">How the AI responded</p>
            <GradeBadge grade={audit.ai_response.grade} />
          </div>
          {audit.ai_response.notes && <p className="mt-2.5 text-sm leading-relaxed text-foreground/85">{audit.ai_response.notes}</p>}
          {audit.ai_response.missed_opportunities.length > 0 && (
            <ul className="mt-2.5 space-y-1">
              {audit.ai_response.missed_opportunities.map((m) => (
                <li key={m} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  {m}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

export function ConversationSheet({
  conv,
  audit,
  open,
  onOpenChange,
}: {
  conv: PreparedConversation | null;
  audit?: ChatAudit;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 data-[side=right]:sm:max-w-xl">
        {conv && <SheetBody key={conv.id} conv={conv} audit={audit} />}
      </SheetContent>
    </Sheet>
  );
}
