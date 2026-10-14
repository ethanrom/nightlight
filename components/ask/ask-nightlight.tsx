"use client";

// "Ask Nightlight": the parent chatbot, with interactive cards inside the answers.
// Needs <ReportContextProvider> and <EvidenceProvider> above it (the report view already has both) and the app's
// <Toaster /> (root layout). It reads the report with useReport(), so it takes no required props.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowUp, Check, CloudOff, Copy, RefreshCw, RotateCcw, Square, SquarePen } from "lucide-react";
import { toast } from "sonner";
import { Answer } from "@/components/ask/answer";
import { EmptyState } from "@/components/ask/empty-state";
import { buildSuggestions } from "@/components/ask/suggestions";
import { LogoMark } from "@/components/brand/logo";
import { useReport } from "@/components/report/report-context";
import { Button } from "@/components/ui/button";
import { buildChatContext } from "@/lib/chat-context";
import { extractCards, normalizeCardBlocks } from "@/lib/chat-cards";
import type { ChatRequest, Report } from "@/lib/types";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------ types and storage

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "error";
  error?: string;
}

const STORE_PREFIX = "nightlight.ask.v2";
const MAX_API_CHARS = 7800; // the API caps a message at 8000

let counter = 0;
const uid = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

function loadMessages(key: string): Msg[] {
  try {
    const raw = window.sessionStorage.getItem(key);
    const v: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(v)) return [];
    return v
      .filter((m): m is Msg => !!m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ id: String(m.id ?? uid()), role: m.role, content: m.content, ...(m.status === "error" ? { status: "error" as const, error: m.error } : {}) }));
  } catch {
    return [];
  }
}

/** What the API gets: alternating turns, only answered questions, cards included so "that starter" has a referent. */
function toApiMessages(msgs: Msg[]): ChatRequest["messages"] {
  const out: ChatRequest["messages"] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role === "user") {
      const reply = msgs[i + 1];
      const last = i === msgs.length - 1;
      if (!last && !(reply && reply.role === "assistant" && reply.status !== "error" && reply.content.trim())) continue;
      out.push({ role: "user", content: m.content.slice(0, MAX_API_CHARS) });
    } else if (m.status !== "error" && m.content.trim()) {
      out.push({ role: "assistant", content: m.content.slice(0, MAX_API_CHARS) });
    }
  }
  return out;
}

async function readError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } };
    if (j?.error?.message) return j.error.message;
  } catch {
    /* not json */
  }
  if (res.status === 429) return "Nightlight is getting a lot of questions right now. Please try again in a moment.";
  return `The assistant couldn’t answer (error ${res.status}).`;
}

const GENERIC_ERROR = "Nightlight couldn’t finish that answer. Nothing was lost, so you can try again.";

function friendlyError(e: unknown): string {
  if (e instanceof TypeError) return "I couldn’t reach Nightlight’s assistant. Check your connection and try again.";
  const msg = e instanceof Error ? e.message : "";
  // keep server messages short and calm; never dump internals at a parent
  return msg && msg.length < 160 && !/missing|credential|aws|bedrock|token/i.test(msg) ? msg : GENERIC_ERROR;
}

/** Plain text of an answer for the clipboard: the prose and any conversation starter, without cards or chips. */
function answerToText(content: string): string {
  const { prose, blocks } = extractCards(normalizeCardBlocks(content));
  const starters = blocks.flatMap((b) => (b.card?.type === "starter" ? [`“${b.card.text}”`] : []));
  return [prose.replace(/\s*\[(?:h:\d+|c:[^\]]+:\d+)\]/g, ""), ...starters].filter(Boolean).join("\n\n");
}

// ------------------------------------------------------------------ small pieces

function Thinking() {
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-sm text-muted-foreground" role="status" aria-live="polite">
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 animate-nl-dot rounded-full bg-primary/70" style={{ animationDelay: `${i * 0.16}s` }} />
        ))}
      </span>
      Reading the report…
    </div>
  );
}

function ErrorNote({ message, onRetry, disabled }: { message: string; onRetry: () => void; disabled: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/60 p-3.5" role="alert">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-card text-muted-foreground ring-1 ring-border">
        <CloudOff className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">That didn’t go through</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{message}</p>
        <Button variant="outline" size="sm" className="mt-2.5 h-7 rounded-full px-3" onClick={onRetry} disabled={disabled}>
          <RotateCcw />
          Try again
        </Button>
      </div>
    </div>
  );
}

const UserBubble = memo(function UserBubble({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex justify-end"
    >
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[0.95rem] leading-relaxed text-pretty text-primary-foreground shadow-soft [overflow-wrap:anywhere]">
        {text}
      </p>
    </motion.div>
  );
});

function Toolbar({ content, canRegenerate, onRegenerate, always }: { content: string; canRegenerate: boolean; onRegenerate: () => void; always: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(answerToText(content));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast.success("Answer copied");
    } catch {
      toast.error("Couldn’t copy. You can select the text instead.");
    }
  }
  return (
    <div
      className={cn(
        "-ml-1.5 flex items-center gap-0.5 text-muted-foreground transition-opacity focus-within:opacity-100",
        always ? "opacity-100" : "opacity-0 group-hover/answer:opacity-100",
      )}
    >
      <Button variant="ghost" size="xs" className="rounded-full text-muted-foreground" onClick={copy} aria-label="Copy answer">
        {copied ? <Check className="text-sev-normal-ink" /> : <Copy />}
        {copied ? "Copied" : "Copy"}
      </Button>
      {canRegenerate && (
        <Button variant="ghost" size="xs" className="rounded-full text-muted-foreground" onClick={onRegenerate} aria-label="Regenerate answer">
          <RefreshCw />
          Regenerate
        </Button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ the panel

export function AskNightlight({ className }: { className?: string }) {
  const { report } = useReport();
  // A new report is a new conversation: remount so state and storage never leak between reports.
  return <AskPanel key={report.generatedAt} report={report} className={className} />;
}

function AskPanel({ report, className }: { report: Report; className?: string }) {
  const { name } = useReport();
  const who = name === "Your child" ? "your child" : name;
  const storeKey = `${STORE_PREFIX}:${report.generatedAt}`;

  const context = useMemo(() => buildChatContext(report), [report]);
  const suggestions = useMemo(() => buildSuggestions(report, name), [report, name]);

  const [messages, setMessages] = useState<Msg[]>(() => (typeof window === "undefined" ? [] : loadMessages(storeKey)));
  const [input, setInput] = useState("");
  const busy = messages.at(-1)?.status === "streaming";

  const messagesRef = useRef(messages);
  const busyRef = useRef(busy);
  useEffect(() => {
    messagesRef.current = messages;
    busyRef.current = busy;
  });
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);

  // ---- persistence (sessionStorage, per report)
  useEffect(() => {
    if (busy) return;
    try {
      if (messages.length === 0) window.sessionStorage.removeItem(storeKey);
      else
        window.sessionStorage.setItem(
          storeKey,
          JSON.stringify(messages.map(({ id, role, content, status, error }) => ({ id, role, content, ...(status === "error" ? { status, error } : {}) }))),
        );
    } catch {
      /* storage full or blocked: the chat still works for this page view */
    }
  }, [messages, busy, storeKey]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // ---- keep the newest text in view, unless the parent scrolled up to read
  const scrollToEnd = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);
  useEffect(() => {
    if (stickRef.current) scrollToEnd();
  }, [messages, scrollToEnd]);
  useEffect(() => {
    const target = contentRef.current;
    if (!target || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stickRef.current) scrollToEnd();
    });
    ro.observe(target);
    return () => ro.disconnect();
  }, [scrollToEnd]);

  // ---- auto-growing composer
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [input]);

  // ---- asking
  const run = useCallback(
    async (history: Msg[], question: string) => {
      const user: Msg = { id: uid(), role: "user", content: question };
      const bot: Msg = { id: uid(), role: "assistant", content: "", status: "streaming" };
      setMessages([...history, user, bot]);
      stickRef.current = true;

      const ac = new AbortController();
      abortRef.current = ac;
      const patch = (p: Partial<Msg>) => setMessages((prev) => prev.map((m) => (m.id === bot.id ? { ...m, ...p } : m)));
      let acc = "";
      let raf = 0;

      try {
        const body: ChatRequest = {
          ageBand: report.ageBand,
          childName: report.childName,
          context,
          messages: toApiMessages([...history, user]),
        };
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) throw new Error(await readError(res));
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          // at most one React update per frame, however fast tokens arrive
          if (!raf) {
            raf = requestAnimationFrame(() => {
              raf = 0;
              patch({ content: acc });
            });
          }
        }
        acc += decoder.decode();
        if (raf) cancelAnimationFrame(raf);
        if (acc.trim()) patch({ content: acc, status: undefined });
        else patch({ content: "", status: "error", error: "I didn’t get an answer back. Please try again." });
      } catch (e) {
        if (raf) cancelAnimationFrame(raf);
        if (ac.signal.aborted) {
          // stopped by the parent: keep whatever had arrived
          if (acc.trim()) patch({ content: acc, status: undefined });
          else patch({ content: "", status: "error", error: "You stopped this answer before it arrived." });
        } else {
          patch({ content: acc, status: "error", error: friendlyError(e) });
        }
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
      }
    },
    [context, report.ageBand, report.childName],
  );

  const send = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q || busyRef.current) return;
      void run(messagesRef.current, q);
    },
    [run],
  );

  const submit = () => {
    if (!input.trim() || busy) return;
    send(input);
    setInput("");
  };

  const stop = () => abortRef.current?.abort();

  /** Re-ask the question behind an answer (used by "Try again" and "Regenerate"). */
  const redo = useCallback(
    (botId: string) => {
      if (busyRef.current) return;
      const list = messagesRef.current;
      const i = list.findIndex((m) => m.id === botId);
      const q = list[i - 1];
      if (i < 1 || q?.role !== "user") return;
      void run(list.slice(0, i - 1), q.content);
    },
    [run],
  );

  const newChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    stickRef.current = true;
    inputRef.current?.focus();
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const empty = messages.length === 0;

  return (
    <div className={cn("nl-card mx-auto flex h-[min(720px,75vh)] min-h-[540px] w-full flex-col overflow-hidden", className)}>
      {/* header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-5">
        <LogoMark size={28} glow={false} />
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold">Ask Nightlight</p>
          <p className="truncate text-xs text-muted-foreground">Answers come only from {who}’s report</p>
        </div>
        {!empty && (
          <Button variant="ghost" size="sm" className="ml-auto rounded-full text-muted-foreground" onClick={newChat}>
            <SquarePen />
            New chat
          </Button>
        )}
      </div>

      {/* conversation */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div ref={contentRef} className={cn(empty ? "min-h-full" : "mx-auto w-full max-w-3xl space-y-7 px-4 py-6 sm:px-6")}>
          {empty ? (
            <EmptyState who={who} suggestions={suggestions} onPick={send} disabled={busy} />
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id} text={m.content} />
              ) : (
                <div key={m.id} className="group/answer flex gap-3">
                  <div className="shrink-0 pt-0.5">
                    <LogoMark size={28} glow={false} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2.5">
                    {m.status === "streaming" && !m.content ? (
                      <Thinking />
                    ) : (
                      m.content && (
                        <Answer
                          content={m.content}
                          streaming={m.status === "streaming"}
                          isLatest={m.id === lastAssistantId}
                          busy={busy}
                          send={send}
                        />
                      )
                    )}
                    {m.status === "error" && (
                      <ErrorNote message={m.error ?? GENERIC_ERROR} onRetry={() => redo(m.id)} disabled={busy} />
                    )}
                    {!m.status && m.content && (
                      <Toolbar
                        content={m.content}
                        canRegenerate={m.id === lastAssistantId && !busy}
                        onRegenerate={() => redo(m.id)}
                        always={m.id === lastAssistantId}
                      />
                    )}
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </div>

      {/* composer */}
      <div className="shrink-0 border-t border-border bg-card/80 px-3 pt-3 pb-2.5 sm:px-5">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-input bg-background p-1.5 pl-4 shadow-soft transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={`Ask about ${who}’s report…`}
              aria-label="Ask a question about the report"
              maxLength={2000}
              className="max-h-[168px] min-h-9 flex-1 resize-none bg-transparent py-2 text-[0.95rem] leading-relaxed outline-none placeholder:text-muted-foreground"
            />
            {busy ? (
              <Button type="button" size="icon-lg" variant="secondary" className="shrink-0 rounded-xl" onClick={stop} aria-label="Stop generating">
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button type="button" size="icon-lg" className="shrink-0 rounded-xl" onClick={submit} disabled={!input.trim()} aria-label="Send">
                <ArrowUp />
              </Button>
            )}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Nightlight can make mistakes and isn’t a clinician. It only knows what’s in this report.
          </p>
        </div>
      </div>
    </div>
  );
}
