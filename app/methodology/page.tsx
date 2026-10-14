import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  EyeOff,
  Heart,
  Laptop,
  Lightbulb,
  Lock,
  ScanEye,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { SiteFooter } from "@/components/landing/site-footer";
import { DimensionBadge, SeverityChip } from "@/components/severity";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import {
  AGE_BANDS,
  AI_RESPONSE_CRITERIA,
  AI_RESPONSE_GRADES,
  AI_RESPONSE_META,
  DIMENSIONS,
  OVERALL_LEVELS,
  OVERALL_META,
  RISK_GROUPS,
  SEVERITIES,
  SEVERITY_META,
  SOURCES,
} from "@/lib/rubric";
import { GROUP_ORDER, GRADE_STYLE, OVERALL_SEVERITY, SEVERITY_STYLE, DIMENSION_ICON } from "@/lib/ui-meta";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How Nightlight's Child Safety Lens works: the 4Cs framework, 14 dimensions, age-band guidance, how AI replies are graded, and exactly what stays on your device.",
};

const NAV = [
  { id: "lens", label: "A child-development lens" },
  { id: "dimensions", label: "The 14 dimensions" },
  { id: "ai-replies", label: "Grading the AI’s replies" },
  { id: "severity", label: "Severity and status" },
  { id: "privacy", label: "Privacy by design" },
  { id: "limits", label: "Limitations and ethics" },
  { id: "sources", label: "Sources" },
];

function SectionHeading({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-28">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={`${id}-title`} className="text-display mt-3 text-3xl text-balance sm:text-4xl">{title}</h2>
      {children && <div className="mt-4 max-w-2xl text-[1.02rem] leading-relaxed text-pretty text-muted-foreground">{children}</div>}
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 size-[640px] -translate-x-1/2 animate-nl-glow rounded-full bg-[radial-gradient(circle,rgb(246_178_74/0.2),transparent_64%)]" />
          <div className="relative mx-auto w-full max-w-[1200px] px-5 pt-16 pb-12 sm:px-8 sm:pt-24 sm:pb-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 py-1.5 pr-3.5 pl-2.5 text-xs font-medium text-foreground/80 shadow-soft">
              <BookOpen className="size-3.5 text-[var(--glow-ink)]" />
              Methodology
            </span>
            <h1 className="text-display mt-6 max-w-3xl text-[2.5rem] text-balance sm:text-[3.6rem]">
              How Nightlight thinks, and what it deliberately doesn’t do.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
              Nightlight does not ask “is this message allowed?” It asks “is this right for a child of this age?”, looking
              across weeks of browsing and AI conversations. Here is the rubric, the evidence behind it, and where it can
              go wrong.
            </p>
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
            {/* 1. the lens */}
            <section aria-labelledby="lens-title">
              <SectionHeading id="lens" eyebrow="The framework" title="A child-development lens">
                <p>
                  The Child Safety Lens is built on the CO:RE <strong className="font-semibold text-foreground">4Cs</strong>{" "}
                  of online risk (Content, Contact, Conduct, Contract) plus cross-cutting risks to health and privacy, and
                  informed by APA, AAP, UNICEF and UK Children’s Code guidance. Each of its 14 dimensions is judged
                  differently at 7, 11, 14 and 17.
                </p>
              </SectionHeading>
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {GROUP_ORDER.map((g) => {
                  const dims = DIMENSIONS.filter((d) => d.group === g);
                  return (
                    <div key={g} className="nl-card p-5">
                      <h3 className="text-title text-lg">{RISK_GROUPS[g].label}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{RISK_GROUPS[g].blurb}</p>
                      <ul className="mt-4 space-y-2">
                        {dims.map((d) => {
                          const Icon = DIMENSION_ICON[d.id];
                          return (
                            <li key={d.id}>
                              <a href={`#dim-${d.id}`} className="group flex items-center gap-2.5 text-sm text-foreground/85 hover:text-primary">
                                <span className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                                  <Icon className="size-3.5" />
                                </span>
                                {d.label}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
                <div className="nl-card flex flex-col justify-between border-[color-mix(in_oklab,var(--glow)_35%,var(--border))] bg-[color-mix(in_oklab,var(--glow)_9%,var(--card))] p-5">
                  <div>
                    <Sparkles className="size-5 text-[var(--glow-ink)]" />
                    <h3 className="text-title mt-3 text-lg">Normal is celebrated</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      Puberty questions, privacy-seeking and curiosity are healthy. The rubric marks them “developmentally
                      normal” so they are never counted as concerns.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. dimensions */}
            <section aria-labelledby="dimensions-title">
              <SectionHeading id="dimensions" eyebrow="The rubric" title="The 14 dimensions">
                <p>
                  For each dimension: what we look for, how the answer changes with age, why a general chatbot’s moderation
                  tends to miss it, and the research it rests on.
                </p>
              </SectionHeading>
              <div className="mt-8 space-y-6">
                {DIMENSIONS.map((d) => {
                  const Icon = DIMENSION_ICON[d.id];
                  return (
                    <article key={d.id} id={`dim-${d.id}`} className="nl-card scroll-mt-28 overflow-hidden">
                      <div className="p-6 sm:p-8">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
                            <Icon className="size-5" />
                          </span>
                          <div>
                            <h3 className="text-title text-xl">{d.label}</h3>
                            <p className="text-sm text-muted-foreground">{RISK_GROUPS[d.group].label} · {RISK_GROUPS[d.group].blurb}</p>
                          </div>
                        </div>
                        <p className="mt-5 max-w-3xl text-[1.02rem] leading-relaxed text-foreground/90">{d.description}</p>

                        <div className="mt-7 grid grid-cols-1 gap-8 lg:grid-cols-2">
                          <div>
                            <h4 className="eyebrow">What we look for</h4>
                            <ul className="mt-3 space-y-2.5">
                              {d.indicators.map((i) => (
                                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground/85">
                                  <Check className="mt-0.5 size-4 shrink-0 text-primary dark:text-[#a8a3ff]" />
                                  {i}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="eyebrow">By age</h4>
                            <div className="mt-3 overflow-hidden rounded-xl border border-border">
                              <table className="w-full text-left text-sm">
                                <caption className="sr-only">What is expected and what is concerning, by age band, for {d.label}</caption>
                                <tbody className="divide-y divide-border">
                                  {AGE_BANDS.map((b) => (
                                    <tr key={b.id} className="align-top">
                                      <th scope="row" className="w-24 bg-muted/60 px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-muted-foreground">
                                        {b.label.replace(" years", "")}
                                      </th>
                                      <td className="px-3 py-2.5 leading-relaxed text-foreground/85">{d.ageNotes[b.id]}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        <div className="mt-7 flex gap-3 rounded-xl bg-[color-mix(in_oklab,var(--glow)_10%,transparent)] px-4 py-3.5">
                          <Lightbulb className="mt-0.5 size-4 shrink-0 text-[var(--glow-ink)]" />
                          <p className="text-sm leading-relaxed text-foreground/85">
                            <span className="font-semibold">Why general moderation misses it. </span>
                            {d.whyMissed}
                          </p>
                        </div>

                        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                          <span className="eyebrow">Sources</span>
                          {d.sources.map((s) => (
                            <a
                              key={s}
                              href={SOURCES[s].url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
                            >
                              {SOURCES[s].org.split(",")[0].split(" – ")[0]} ({SOURCES[s].year})
                            </a>
                          ))}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* 3. AI replies */}
            <section aria-labelledby="ai-replies-title">
              <SectionHeading id="ai-replies" eyebrow="The other half of the chat" title="Grading the AI’s own replies">
                <p>
                  A child’s message is only half of a conversation. Nightlight also grades how the AI answered a child, using
                  the checklist below, and lists what a child-appropriate reply would have done.
                </p>
              </SectionHeading>
              <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="nl-card p-6">
                  <h3 className="text-title text-lg">What a child-safe AI should do</h3>
                  <ul className="mt-4 space-y-3">
                    {AI_RESPONSE_CRITERIA.map((c) => (
                      <li key={c} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-sev-normal-soft text-sev-normal-ink">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="nl-card p-6">
                  <h3 className="text-title text-lg">The four grades</h3>
                  <ul className="mt-4 space-y-4">
                    {AI_RESPONSE_GRADES.map((g) => (
                      <li key={g} className="flex gap-3">
                        <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", GRADE_STYLE[g].dot)} />
                        <div>
                          <p className="text-sm font-semibold">{AI_RESPONSE_META[g].label}</p>
                          <p className="text-sm text-muted-foreground">{AI_RESPONSE_META[g].blurb}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* 4. severity */}
            <section aria-labelledby="severity-title">
              <SectionHeading id="severity" eyebrow="Reading the report" title="Severity and status">
                <p>
                  Colour appears only on small chips, dots and accent bars, and never on its own: every signal also carries
                  a label. Developmentally normal things stay in a separate, friendly section.
                </p>
              </SectionHeading>
              <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="nl-card p-6">
                  <h3 className="text-title text-lg">Each signal</h3>
                  <ul className="mt-4 space-y-4">
                    {SEVERITIES.map((s) => (
                      <li key={s} className="flex items-start gap-3">
                        <SeverityChip severity={s} className="mt-0.5 w-36 justify-start" />
                        <p className="text-sm leading-relaxed text-muted-foreground">{SEVERITY_META[s].blurb}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="nl-card p-6">
                  <h3 className="text-title text-lg">The overall picture</h3>
                  <ul className="mt-4 space-y-4">
                    {OVERALL_LEVELS.map((l) => (
                      <li key={l} className="flex items-start gap-3">
                        <span className={cn("mt-1.5 h-2 w-8 shrink-0 rounded-full", SEVERITY_STYLE[OVERALL_SEVERITY[l]].bar)} />
                        <div>
                          <p className="text-sm font-semibold">{OVERALL_META[l].label}</p>
                          <p className="text-sm text-muted-foreground">{OVERALL_META[l].blurb}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-5">
                    <span className="eyebrow mr-1">Scorecard dots</span>
                    <DimensionBadge id="emotional_reliance" />
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-2 rounded-full bg-sev-normal" /> clear
                      <span className="ml-2 size-2 rounded-full bg-sev-notice" /> watch
                      <span className="ml-2 size-2 rounded-full bg-sev-talk" /> concern
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. privacy */}
            <section aria-labelledby="privacy-title">
              <SectionHeading id="privacy" eyebrow="What leaves your device" title="Privacy by design">
                <p>
                  The most sensitive thing in this app is a child’s history. So the design starts from keeping it where it
                  is, and sending only what the analysis truly needs.
                </p>
              </SectionHeading>
              <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
                <PrivacyCard
                  icon={Laptop}
                  title="Stays on your device"
                  tone="normal"
                  items={[
                    "Your raw files: the history database, chat exports and pasted transcripts",
                    "Full URLs and query strings",
                    "The finished report, kept only in this browser tab",
                    "Everything about which evidence is blurred or revealed",
                  ]}
                />
                <PrivacyCard
                  icon={ScanEye}
                  title="Sent for analysis"
                  tone="notice"
                  items={[
                    "Compact, redacted text: site, page title, search terms and visit counts",
                    "Chat messages with emails, phone numbers, addresses, schools and handles masked first",
                    "Your child’s age band and optional nickname",
                    "Sent to Claude through Nightlight’s own API routes",
                  ]}
                />
                <PrivacyCard
                  icon={Trash2}
                  title="Never stored"
                  tone="talk"
                  items={[
                    "No accounts, no database, no content analytics",
                    "The API routes relay a request and return the answer",
                    "“New analysis” or closing the tab clears the report",
                    "Only anonymous usage counters are kept to protect the public demo: a salted hash of the network address and an estimated spend, deleted within two days",
                  ]}
                />
              </div>
              <p className="mt-5 flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                <Lock className="mt-0.5 size-4 shrink-0" />
                Redaction is pattern-based and best-effort. It can miss unusual formats, which is why Nightlight also keeps
                evidence blurred in the report and never loads outside resources, such as favicons, that would reveal which
                sites were visited.
              </p>
            </section>

            {/* 6. limits */}
            <section aria-labelledby="limits-title">
              <SectionHeading id="limits" eyebrow="Honesty" title="Limitations and ethics" />
              <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
                <LimitCard icon={Heart} title="A conversation aid, not a diagnosis">
                  Nightlight can spot patterns, not read minds or assess a child’s health. A concern is a prompt to talk, never
                  a verdict, and low mood or risk always deserves a human, and where needed a professional.
                </LimitCard>
                <LimitCard icon={EyeOff} title="Tell your child">
                  Secret monitoring can erode the trust that actually keeps children safe. We encourage telling your child you
                  use Nightlight, doing the export together, and reviewing the results with them.
                </LimitCard>
                <LimitCard icon={ShieldCheck} title="False positives and negatives happen">
                  AI can misread sarcasm, fiction, song lyrics, slang and jokes, and it can miss things. It only sees what
                  you upload: one browser, one account, and nothing that was deleted.
                </LimitCard>
                <LimitCard icon={Sparkles} title="We show what we skipped">
                  Large exports are sampled to fit the analysis budget. The report always states “Analysed X of Y”, and flags
                  anything that couldn’t be analysed, rather than hiding it.
                </LimitCard>
              </div>
            </section>

            {/* 7. sources */}
            <section aria-labelledby="sources-title">
              <SectionHeading id="sources" eyebrow="Standing on research" title="Sources" />
              <ol className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
                {Object.values(SOURCES).map((s) => (
                  <li key={s.url} className="flex flex-col gap-1 p-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                    <div className="min-w-0">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[0.95rem] font-medium underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
                      >
                        {s.title}
                      </a>
                      <p className="mt-0.5 text-sm text-muted-foreground">{s.org}</p>
                    </div>
                    <span className="text-sm text-muted-foreground tabular-nums">{s.year}</span>
                  </li>
                ))}
              </ol>

              <div className="nl-card mt-12 flex flex-col items-start justify-between gap-5 p-7 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-title text-xl">See it on a real-looking report</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Try the demo, or analyse your own files. It takes a couple of minutes.</p>
                </div>
                <Link href="/" className={cn(buttonVariants({ size: "lg" }), "h-11 rounded-full px-6")}>
                  Back to Nightlight <ArrowRight className="size-4" />
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function PrivacyCard({
  icon: Icon,
  title,
  items,
  tone,
}: {
  icon: typeof Laptop;
  title: string;
  items: string[];
  tone: "normal" | "notice" | "talk";
}) {
  const bar = { normal: "bg-sev-normal", notice: "bg-sev-notice", talk: "bg-sev-talk" }[tone];
  return (
    <div className="nl-card relative overflow-hidden p-6">
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", bar)} />
      <span className="grid size-10 place-items-center rounded-2xl bg-muted text-foreground/80">
        <Icon className="size-5" />
      </span>
      <h3 className="text-title mt-4 text-lg">{title}</h3>
      <ul className="mt-4 space-y-3">
        {items.map((i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground/85">
            <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LimitCard({ icon: Icon, title, children }: { icon: typeof Heart; title: string; children: React.ReactNode }) {
  return (
    <div className="nl-card p-6">
      <span className="grid size-10 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <Icon className="size-5" />
      </span>
      <h3 className="text-title mt-4 text-lg">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
