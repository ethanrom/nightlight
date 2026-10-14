"use client";

import { Bot, Flag, User } from "lucide-react";
import { Blurred } from "@/components/report/blur";
import { fmtTime } from "@/lib/format";
import type { Severity } from "@/lib/rubric";
import { SEVERITY_STYLE } from "@/lib/ui-meta";
import type { PreparedMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A single chat message. Blurred unless `revealed`; flagged messages get a soft severity ring. */
export function ChatBubble({
  message,
  revealed,
  onRevealRequest,
  flagSeverity,
  flagNote,
  childName,
  id,
}: {
  message: PreparedMessage;
  revealed: boolean;
  onRevealRequest?: () => void;
  flagSeverity?: Severity;
  flagNote?: string;
  childName: string;
  id?: string;
}) {
  const isChild = message.role === "child";
  const sev = flagSeverity ? SEVERITY_STYLE[flagSeverity] : null;
  return (
    <div id={id} className={cn("flex gap-2.5", isChild ? "flex-row-reverse" : "flex-row")}>
      <span
        className={cn(
          "mt-1 grid size-7 shrink-0 place-items-center rounded-full",
          isChild ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        {isChild ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </span>
      <div className={cn("flex max-w-[82%] flex-col gap-1", isChild ? "items-end" : "items-start")}>
        <div className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
          <span>{isChild ? childName : "AI"}</span>
          {message.ts && <span className="tabular-nums">{fmtTime(message.ts)}</span>}
        </div>
        <div
          role={!revealed && onRevealRequest ? "button" : undefined}
          tabIndex={!revealed && onRevealRequest ? 0 : undefined}
          aria-label={!revealed ? "Hidden message. Activate to reveal." : undefined}
          onClick={!revealed ? onRevealRequest : undefined}
          onKeyDown={(e) => {
            if (!revealed && onRevealRequest && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onRevealRequest();
            }
          }}
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
            isChild ? "rounded-tr-md bg-primary/10 text-foreground" : "rounded-tl-md bg-muted text-foreground",
            !revealed && onRevealRequest && "cursor-pointer",
            sev && cn("ring-2", sev.ring),
          )}
        >
          <Blurred revealed={revealed} className="block whitespace-pre-wrap">
            {message.text}
          </Blurred>
        </div>
        {sev && flagNote && (
          <p className={cn("flex items-start gap-1.5 text-xs leading-relaxed", sev.ink)}>
            <Flag className="mt-0.5 size-3 shrink-0" />
            <span>{flagNote}</span>
          </p>
        )}
      </div>
    </div>
  );
}
