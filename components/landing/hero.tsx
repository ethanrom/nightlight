"use client";

import { ArrowRight, Eye, EyeOff, Laptop, MoonStar, Quote, ShieldCheck, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { EASE, FadeUp } from "@/components/motion";
import { SeverityChip, SeverityDot } from "@/components/severity";
import { buttonVariants } from "@/components/ui/button";
import { useReportStore } from "@/lib/report-store";
import { cn } from "@/lib/utils";

const PRIVACY = [
  { icon: Laptop, text: "Parsed in your browser" },
  { icon: EyeOff, text: "Personal details redacted before analysis" },
  { icon: ShieldCheck, text: "Your data isn’t stored" },
];

export function Hero() {
  const { startDemo } = useReportStore();
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-14 px-5 pt-14 pb-16 sm:px-8 sm:pt-20 sm:pb-24 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
        <div>
          <FadeUp>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 py-1.5 pr-3.5 pl-2.5 text-xs font-medium text-foreground/80 shadow-soft backdrop-blur">
              <MoonStar className="size-3.5 text-[var(--glow-ink)]" />
              Understand, don’t surveil
            </span>
          </FadeUp>
          <FadeUp delay={0.06}>
            <h1 className="text-display mt-6 text-[2.55rem] text-balance sm:text-[3.4rem] lg:text-[4rem]">
              Understand your child’s online world{" "}
              <span className="bg-gradient-to-r from-primary via-[#8a64ee] to-[#c06ad8] bg-clip-text text-transparent dark:from-[#9c96ff] dark:via-[#b393ff] dark:to-[#e0a2f0]">
                — without reading every message.
              </span>
            </h1>
          </FadeUp>
          <FadeUp delay={0.12}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
              An AI reads the patterns across browsing and chatbot conversations, through a child-development lens, so
              you don’t have to. You get what matters, kindly framed, with a way to start the conversation.
            </p>
          </FadeUp>
          <FadeUp delay={0.18}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void startDemo()}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "group h-12 gap-2 rounded-full px-6 text-[0.95rem] shadow-[0_10px_30px_-10px_rgb(77_68_214/0.7)] hover:bg-primary/90",
                )}
              >
                <Sparkles className="size-4" />
                Try the demo
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <a
                href="#upload"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 rounded-full bg-card/70 px-6 text-[0.95rem] backdrop-blur",
                )}
              >
                Analyse your own files
              </a>
            </div>
          </FadeUp>
          <FadeUp delay={0.24}>
            <ul className="mt-9 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-6">
              {PRIVACY.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-accent text-accent-foreground">
                    <Icon className="size-3.5" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </FadeUp>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

/** A tasteful stack of mini dashboard cards on a pulsing nightlight glow. */
function HeroPreview() {
  return (
    <div className="relative mx-auto h-[620px] w-full max-w-[520px] sm:h-[590px]" aria-hidden>
      {/* glow */}
      <div className="absolute top-1/2 left-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 animate-nl-glow rounded-full bg-[radial-gradient(circle,rgb(246_178_74/0.34),transparent_62%)]" />
      <div className="absolute top-[58%] left-[55%] size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(106_98_234/0.26),transparent_65%)]" />

      {/* floating: evidence blurred */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.7, ease: EASE }}
        className="absolute top-2 right-0 z-20 hidden w-[210px] animate-nl-float-slow sm:block sm:-right-3"
      >
        <div className="nl-card bg-card p-3.5 shadow-lift">
          <div className="flex items-center gap-2 text-[0.7rem] font-medium text-muted-foreground">
            <Eye className="size-3.5" />
            Evidence stays blurred
          </div>
          <div className="mt-2 space-y-1.5 blur-[3.5px]">
            <div className="h-2 w-full rounded bg-foreground/25" />
            <div className="h-2 w-4/5 rounded bg-foreground/25" />
          </div>
          <p className="mt-2.5 text-[0.7rem] text-muted-foreground">You choose when to reveal.</p>
        </div>
      </motion.div>

      {/* main card */}
      <motion.div
        initial={{ opacity: 0, y: 28, rotate: 1.5 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
        className="absolute inset-x-0 top-12 z-10 sm:inset-x-4"
      >
        <div className="nl-card p-5 shadow-lift sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-[#7a72f2] to-[#4338c9] text-sm font-semibold text-white">
                M
              </span>
              <div>
                <p className="text-sm leading-tight font-semibold">Maya</p>
                <p className="text-xs text-muted-foreground">Ages 13–15 · Sep 22 – Oct 12</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-4 rounded-2xl bg-sev-talk-soft p-4">
            <span className="relative grid size-12 shrink-0 place-items-center">
              <span className="absolute inset-0 animate-nl-orb rounded-full bg-[radial-gradient(circle,rgb(240_178_61/0.8),rgb(240_178_61/0.1)_70%)]" />
              <span className="relative size-5 rounded-full bg-sev-talk shadow-[0_0_24px_6px_rgb(240_178_61/0.55)]" />
            </span>
            <div>
              <p className="text-base font-semibold tracking-tight">Time for a chat</p>
              <p className="text-sm text-muted-foreground">A few things are worth talking about soon.</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border/80 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">Mood in AI chats</p>
              <span className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                <span className="size-2 rounded-full bg-chart-2" /> after midnight
              </span>
            </div>
            <MiniMood />
          </div>

          <ul className="mt-4 space-y-2.5">
            {[
              { sev: "talk_soon" as const, text: "A nightly AI companion is becoming a main confidant", chip: "Talk soon" },
              { sev: "worth_noticing" as const, text: "Whole essay outsourced to a chatbot, once", chip: "Worth noticing" },
              { sev: "normal" as const, text: "Period questions: healthy, normal curiosity", chip: "Normal" },
            ].map((r) => (
              <li key={r.text} className="flex items-center gap-3 text-sm">
                <SeverityDot severity={r.sev} className="size-2.5" />
                <span className="min-w-0 flex-1 truncate">{r.text}</span>
                <SeverityChip severity={r.sev} label={r.chip} showDot={false} className="hidden h-5 text-[0.65rem] sm:inline-flex" />
              </li>
            ))}
          </ul>
        </div>
      </motion.div>

      {/* floating: conversation starter */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.95, ease: EASE }}
        className="absolute bottom-0 left-0 z-20 w-[290px] animate-nl-float sm:-left-4"
      >
        <div className="nl-card border-[color-mix(in_oklab,var(--glow)_45%,var(--border))] bg-card p-4 shadow-lift">
          <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-wide text-[var(--glow-ink)] uppercase">
            <Quote className="size-3" /> Conversation starter
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            “I’ve noticed you’re up late a lot. No judgement, I’d love to hear what’s on your mind.”
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function MiniMood() {
  // decorative: mood readings across a few weeks, with amber dots for after-midnight chats
  const pts: [number, number, boolean][] = [
    [8, 22, false], [52, 18, false], [96, 24, true], [140, 20, false], [184, 30, true],
    [228, 40, false], [272, 48, true], [316, 38, true], [360, 52, true],
  ];
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  return (
    <svg viewBox="0 0 368 64" className="mt-2 h-14 w-full" fill="none">
      <line x1="0" x2="368" y1="32" y2="32" stroke="var(--chart-grid)" strokeWidth="1" />
      <path d={d} stroke="var(--chart-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y, late], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="4"
          fill={late ? "var(--chart-2)" : "var(--chart-1)"}
          stroke="var(--card)"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}
