"use client";

import { ArrowDown, Bot, Eye } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import { DimensionBadge, SeverityChip } from "@/components/severity";
import type { DimensionId, Severity } from "@/lib/rubric";
import { SEVERITY_STYLE } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

interface Example {
  dimension: DimensionId;
  severity: Severity;
  saw: { prompt: string; note: string };
  sees: { title: string; text: string };
}

const EXAMPLES: Example[] = [
  {
    dimension: "body_image_food",
    severity: "talk_soon",
    saw: {
      prompt: "“Make me a meal plan to lose 5kg in two weeks.”",
      note: "A perfectly normal request. The chatbot replies with a 1,200-calorie plan.",
    },
    sees: {
      title: "Body-image risk for a 14-year-old",
      text: "Restrictive dieting during growth is a common route into disordered eating. Nightlight links it to the calorie searches the day before.",
    },
  },
  {
    dimension: "secrecy_isolation",
    severity: "talk_soon",
    saw: {
      prompt: "“How do I hide an app on my iPhone?”",
      note: "An ordinary tech question, answered step by step.",
    },
    sees: {
      title: "Secrecy from trusted adults",
      text: "On its own it is a privacy question. Next to a new online contact, it is a pattern worth a gentle conversation.",
    },
  },
  {
    dimension: "wellbeing_drift",
    severity: "talk_soon",
    saw: {
      prompt: "Six chats at 2am, each one just venting.",
      note: "Every message is polite and fine. Nothing breaks a content policy.",
    },
    sees: {
      title: "Wellbeing drift and AI reliance",
      text: "Mood fell week after week and the chats moved later into the night. The pattern shows what no single message can.",
    },
  },
  {
    dimension: "contact_risk",
    severity: "urgent",
    saw: {
      prompt: "“My Roblox friend sent me gift cards. Is that normal?”",
      note: "One question about a friend, with a cautious, generic reply.",
    },
    sees: {
      title: "Grooming-pattern contact risk",
      text: "An older contact, gifts, secrecy and a request to move apps. Nightlight recognises the stages and suggests what to do today.",
    },
  },
];

export function WontFlag() {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-5 py-16 sm:px-8 sm:py-20" aria-labelledby="wont-flag-title">
      <div className="max-w-2xl">
        <p className="eyebrow">What general moderation misses</p>
        <h2 id="wont-flag-title" className="text-display mt-3 text-3xl text-balance sm:text-[2.6rem]">
          ChatGPT sees one chat. Nightlight sees the pattern.
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-pretty text-muted-foreground">
          General chatbots ask “is this message allowed?” Nightlight asks “is this right for a child this age?”, across
          weeks, and grades how the AI itself responded.
        </p>
      </div>

      <Stagger className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2" gap={0.09}>
        {EXAMPLES.map((ex) => (
          <StaggerItem key={ex.sees.title}>
            <article className="nl-card nl-card-hover h-full overflow-hidden">
              <div className="bg-muted/60 p-5 sm:p-6">
                <p className="eyebrow flex items-center gap-1.5">
                  <Bot className="size-3.5" /> What the chatbot saw
                </p>
                <p className="mt-3 text-[1.02rem] leading-snug font-medium text-foreground/90">{ex.saw.prompt}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">{ex.saw.note}</p>
              </div>
              <div className="relative border-t border-border/70 p-5 pl-6 sm:p-6 sm:pl-7">
                <span className={cn("absolute top-5 bottom-5 left-0 w-1 rounded-r-full", SEVERITY_STYLE[ex.severity].bar)} />
                <span className="absolute -top-3.5 left-6 grid size-7 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft sm:left-7">
                  <ArrowDown className="size-3.5" />
                </span>
                <p className="eyebrow flex items-center gap-1.5 text-primary dark:text-[#a8a3ff]">
                  <Eye className="size-3.5" /> What Nightlight sees
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <DimensionBadge id={ex.dimension} />
                  <SeverityChip severity={ex.severity} />
                </div>
                <h3 className="text-title mt-3 text-lg">{ex.sees.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{ex.sees.text}</p>
              </div>
            </article>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
