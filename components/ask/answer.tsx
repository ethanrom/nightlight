"use client";

import { Children, isValidElement, memo, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { motion } from "motion/react";
import {
  BookOpen,
  ChartLine,
  CircleAlert,
  HandHeart,
  ListChecks,
  MessageCircleHeart,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { AnswerProvider, useAnswer, type AnswerCtxValue } from "@/components/ask/answer-context";
import { ChartCard } from "@/components/ask/cards/chart-card";
import { CardSkeleton } from "@/components/ask/cards/card-shell";
import { ConcernCard } from "@/components/ask/cards/concern-card";
import { DimensionCard } from "@/components/ask/cards/dimension-card";
import { EvidenceCard } from "@/components/ask/cards/evidence-card";
import { FollowupsCard } from "@/components/ask/cards/followups-card";
import { PlanCard } from "@/components/ask/cards/plan-card";
import { ResourcesCard } from "@/components/ask/cards/resources-card";
import { StarterCard } from "@/components/ask/cards/starter-card";
import { EvidenceChip, resolveChat, resolveHistory } from "@/components/report/evidence";
import { useReport } from "@/components/report/report-context";
import {
  CITE_HREF_PREFIX,
  isCardLang,
  linkifyCitations,
  normalizeCardBlocks,
  openFenceLine,
  parseCard,
  peekCardType,
  type Card,
  type CardType,
} from "@/lib/chat-cards";
import { parseEvidenceRef } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------ cards

const SKELETON: Record<CardType, { icon: LucideIcon; label: string }> = {
  evidence: { icon: ShieldCheck, label: "Pulling up the evidence" },
  starter: { icon: MessageCircleHeart, label: "Finding the words" },
  chart: { icon: ChartLine, label: "Drawing a chart" },
  concern: { icon: CircleAlert, label: "Checking the report" },
  resources: { icon: HandHeart, label: "Finding support" },
  plan: { icon: ListChecks, label: "Putting a plan together" },
  followups: { icon: MessageCircleHeart, label: "Thinking of next questions" },
  dimension: { icon: BookOpen, label: "Looking this up" },
};

function renderCard(card: Card) {
  switch (card.type) {
    case "evidence":
      return <EvidenceCard card={card} />;
    case "starter":
      return <StarterCard card={card} />;
    case "chart":
      return <ChartCard card={card} />;
    case "concern":
      return <ConcernCard card={card} />;
    case "resources":
      return <ResourcesCard card={card} />;
    case "plan":
      return <PlanCard card={card} />;
    case "followups":
      return <FollowupsCard card={card} />;
    case "dimension":
      return <DimensionCard card={card} />;
  }
}

/** One ```card block: a finished card, a skeleton while its JSON is still streaming, or nothing if it is invalid. */
function CardBlock({ raw, line }: { raw: string; line?: number }) {
  const { streaming, openLine } = useAnswer();
  const card = parseCard(raw);
  if (card) {
    return (
      // `empty:hidden`: a card that renders nothing (e.g. only unknown refs) must not leave a gap in the flow.
      <motion.div
        className="empty:hidden"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {renderCard(card)}
      </motion.div>
    );
  }
  if (streaming && line !== undefined && line === openLine) {
    const meta = SKELETON[peekCardType(raw) ?? "evidence"];
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        <CardSkeleton icon={meta.icon} label={meta.label} />
      </motion.div>
    );
  }
  return null; // invalid JSON: dropped silently
}

// ------------------------------------------------------------------ inline evidence chips

function Cite({ refStr }: { refStr: string }) {
  const { report } = useReport();
  const parsed = parseEvidenceRef(refStr);
  const exists =
    parsed?.type === "history"
      ? !!resolveHistory(report, parsed.id)
      : parsed?.type === "chat"
        ? !!resolveChat(report, parsed.convId, parsed.index)
        : false;
  if (!exists) return null; // never show a chip for something that is not in the report
  return <EvidenceChip refStr={refStr} className="mx-0.5 h-6 align-middle" />;
}

// ------------------------------------------------------------------ markdown

// Defined once at module level: a new `components` object per render would remount every card on every token.
const MD: Components = {
  p: ({ children }) => <p className="leading-relaxed text-pretty">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1.5 pl-5 marker:text-muted-foreground">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed text-pretty">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <p className="text-title text-base">{children}</p>,
  h2: ({ children }) => <p className="text-title text-base">{children}</p>,
  h3: ({ children }) => <p className="text-title text-[0.95rem]">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3.5 text-muted-foreground italic">{children}</blockquote>
  ),
  hr: () => <hr className="border-border" />,
  a: ({ href, children }) =>
    href?.startsWith(CITE_HREF_PREFIX) ? <Cite refStr={decodeURIComponent(href.slice(CITE_HREF_PREFIX.length))} /> : <>{children}</>,
  pre: ({ children }) => {
    const child = Children.toArray(children)[0];
    if (isValidElement<{ className?: string }>(child) && isCardLang(child.props.className)) return <>{children}</>;
    // never show raw card JSON, however the model fenced it
    if (isValidElement<{ children?: unknown }>(child) && /^\s*\{\s*"type"\s*:/.test(String(child.props.children ?? ""))) return null;
    return <pre className="overflow-x-auto rounded-xl bg-muted p-3 font-mono text-xs leading-relaxed">{children}</pre>;
  },
  code: ({ className, children, node }) => {
    if (isCardLang(className)) {
      return <CardBlock raw={String(children).replace(/\n$/, "")} line={node?.position?.start.line} />;
    }
    return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>;
  },
};

/** A soft pulsing dot after the last paragraph or bullet while text is still arriving. */
const CURSOR =
  "[&>p:last-child]:after:ml-1.5 [&>p:last-child]:after:inline-block [&>p:last-child]:after:size-2 [&>p:last-child]:after:rounded-full [&>p:last-child]:after:bg-primary [&>p:last-child]:after:align-middle [&>p:last-child]:after:animate-pulse [&>p:last-child]:after:content-[''] " +
  "[&>ul:last-child>li:last-child]:after:ml-1.5 [&>ul:last-child>li:last-child]:after:inline-block [&>ul:last-child>li:last-child]:after:size-2 [&>ul:last-child>li:last-child]:after:rounded-full [&>ul:last-child>li:last-child]:after:bg-primary [&>ul:last-child>li:last-child]:after:align-middle [&>ul:last-child>li:last-child]:after:animate-pulse [&>ul:last-child>li:last-child]:after:content-['']";

export interface AnswerProps {
  content: string;
  streaming: boolean;
  isLatest: boolean;
  busy: boolean;
  send: (text: string) => void;
}

/** An assistant answer: streamed markdown, inline evidence chips and interactive cards. */
export const Answer = memo(function Answer({ content, streaming, isLatest, busy, send }: AnswerProps) {
  // normalise first (adds/relabels fences), then linkify citations; neither changes the position of existing lines
  const text = useMemo(() => linkifyCitations(normalizeCardBlocks(content, streaming)), [content, streaming]);
  const openLine = streaming ? openFenceLine(text) : null;
  const ctx = useMemo<AnswerCtxValue>(
    () => ({ streaming, openLine, isLatest, busy, send }),
    [streaming, openLine, isLatest, busy, send],
  );
  return (
    <AnswerProvider value={ctx}>
      <div className={cn("flex min-w-0 flex-col gap-3 text-[0.95rem] text-foreground/90", streaming && CURSOR)}>
        <ReactMarkdown components={MD}>{text}</ReactMarkdown>
      </div>
    </AnswerProvider>
  );
});
