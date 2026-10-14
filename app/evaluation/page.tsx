import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { AiGrades } from "@/components/evaluation/ai-grades";
import { DetectionMatrix } from "@/components/evaluation/detection-matrix";
import { FalseAlarms } from "@/components/evaluation/false-alarms";
import { HeroKpis } from "@/components/evaluation/hero-kpis";
import { HowWeTested } from "@/components/evaluation/how-we-tested";
import { MethodCards } from "@/components/evaluation/method-cards";
import { PatternExplorer } from "@/components/evaluation/pattern-explorer";
import { SectionHeading } from "@/components/evaluation/section-heading";
import { spanWords } from "@/components/evaluation/eval-utils";
import { SiteFooter } from "@/components/landing/site-footer";
import { FadeUp } from "@/components/motion";
import { SiteHeader } from "@/components/site-header";
import raw from "@/data/eval-results.json";
import type { EvalResults } from "@/lib/eval-types";
import { fmtNum } from "@/lib/format";

const results = raw as unknown as EvalResults;

export const metadata: Metadata = {
  title: "Evaluation",
  description:
    "We measured Nightlight against a labelled synthetic dataset and two baselines: what it caught, what it missed, what it raised by mistake, and how consistent it was across runs.",
};

const NAV = [
  { id: "methods", label: "Three ways to read it" },
  { id: "matrix", label: "Detection matrix" },
  { id: "patterns", label: "Patterns across chats" },
  { id: "ai-replies", label: "Grading the AI’s replies" },
  { id: "false-alarms", label: "False alarms" },
  { id: "how", label: "How we tested" },
];

export default function EvaluationPage() {
  const { dataset: d, runs } = results;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 left-1/2 size-[640px] -translate-x-1/2 animate-nl-glow rounded-full bg-[radial-gradient(circle,rgb(246_178_74/0.2),transparent_64%)]"
          />
          <div className="relative mx-auto w-full max-w-[1200px] px-5 pt-16 pb-12 sm:px-8 sm:pt-24 sm:pb-16">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 py-1.5 pr-3.5 pl-2.5 text-xs font-medium text-foreground/80 shadow-soft">
                <FlaskConical className="size-3.5 text-[var(--glow-ink)]" />
                Evaluation
              </span>
              {results.placeholder && (
                <span className="inline-flex h-7 items-center rounded-full bg-[color-mix(in_oklab,var(--glow)_22%,transparent)] px-3 text-[0.68rem] font-semibold tracking-wide text-[var(--glow-ink)] uppercase">
                  Preview data
                </span>
              )}
            </div>
            <h1 className="text-display mt-6 max-w-3xl text-[2.5rem] text-balance sm:text-[3.6rem]">
              Does it actually work? We measured it.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
              A labelled synthetic dataset of{" "}
              <span className="tabular-nums">{fmtNum(d.days)}</span> days, run{" "}
              <span className="tabular-nums">{fmtNum(runs)}</span> times against two baselines. Here is what Nightlight
              caught, what it missed, and what it raised by mistake.
            </p>

            <div className="mt-10">
              <HeroKpis results={results} />
            </div>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-[1200px] gap-12 px-5 pb-24 sm:px-8 lg:grid-cols-[13.5rem_1fr] lg:gap-16">
          <aside className="hidden lg:block">
            <nav aria-label="On this page" className="sticky top-24">
              <p className="eyebrow mb-3">On this page</p>
              <ul className="space-y-1 border-l border-border">
                {NAV.map((n) => (
                  <li key={n.id}>
                    <a
                      href={`#${n.id}`}
                      className="-ml-px block border-l border-transparent py-1.5 pl-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      {n.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <div className="min-w-0 space-y-24">
            {/* 1. three methods */}
            <section aria-labelledby="methods-title">
              <SectionHeading
                id="methods"
                eyebrow="The comparison"
                title={`Three ways to read the same ${spanWords(d.days)}`}
              >
                <p>
                  A chatbot’s own moderation sees one message at a time and is built for adults. Nightlight reads across
                  conversations, through a child-development lens. To see which part of that matters, we ran both ideas on
                  the same data.
                </p>
              </SectionHeading>
              <div className="mt-8">
                <MethodCards results={results} />
              </div>
            </section>

            {/* 2. detection matrix */}
            <section aria-labelledby="matrix-title">
              <SectionHeading id="matrix" eyebrow="Signal by signal" title="Detection matrix">
                <p>
                  Every planted signal, grouped by what it is about. Normal items are in here too, because the right
                  answer for them is to leave them alone.
                </p>
              </SectionHeading>
              <FadeUp inView className="mt-8">
                <DetectionMatrix results={results} />
              </FadeUp>
            </section>

            {/* 3. patterns */}
            <section aria-labelledby="patterns-title">
              <SectionHeading id="patterns" eyebrow="The centrepiece" title="The pattern only shows up together">
                <p>
                  Some of the most important things are never in a single message. Pick a pattern to see the evidence in
                  time order, how each chat looks on its own, and what each method made of it.
                </p>
              </SectionHeading>
              <FadeUp inView className="mt-8">
                <PatternExplorer results={results} />
              </FadeUp>
            </section>

            {/* 4. AI replies */}
            <section aria-labelledby="ai-replies-title">
              <SectionHeading id="ai-replies" eyebrow="The other half of the chat" title="Grading the AI’s own replies">
                <p>
                  Nightlight also grades how the chatbot answered the child. Here is the grade we expected for each
                  conversation, and the grade Nightlight gave in every run.
                </p>
              </SectionHeading>
              <div className="mt-8">
                <AiGrades results={results} />
              </div>
            </section>

            {/* 5. false alarms */}
            <section aria-labelledby="false-alarms-title">
              <SectionHeading id="false-alarms" eyebrow="Nothing hidden" title="False alarms">
                <p>
                  A tool that cries wolf stops being trusted. These are the harmless items a method raised as a concern,
                  listed in full.
                </p>
              </SectionHeading>
              <div className="mt-8">
                <FalseAlarms results={results} />
              </div>
            </section>

            {/* 6. how we tested */}
            <section aria-labelledby="how-title">
              <SectionHeading id="how" eyebrow="Method and limits" title="How we tested">
                <p>
                  The dataset, how the answer key was made, what this does not show, and how to run it yourself.
                </p>
              </SectionHeading>
              <div className="mt-8">
                <HowWeTested results={results} />
              </div>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
