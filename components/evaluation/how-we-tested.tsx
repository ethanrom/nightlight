import { Brain, Database, ExternalLink, FileCheck2, ListChecks, Scale, Terminal, TriangleAlert } from "lucide-react";
import { METHOD_META } from "@/components/evaluation/eval-utils";
import { FadeUp } from "@/components/motion";
import type { EvalResults } from "@/lib/eval-types";
import { fmtNum } from "@/lib/format";
import { AGE_BANDS } from "@/lib/rubric";

const REPO = "https://github.com/ethanrom/nightlight/blob/main";
const ANSWER_KEY_URL = `${REPO}/eval/answer-key.ts`;
const WRITE_UP_URL = `${REPO}/docs/evaluation.md`;

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3.5 py-3">
      <dd className="text-xl font-semibold tracking-tight tabular-nums">{value}</dd>
      <dt className="mt-0.5 text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary dark:text-[#a8a3ff]"
    >
      {children}
      <ExternalLink className="size-3.5" />
    </a>
  );
}

export function HowWeTested({ results }: { results: EvalResults }) {
  const { dataset: d, models, limitations, runs, signals } = results;
  const normalControls = signals.filter((s) => s.expected === "normal").length;
  const age = AGE_BANDS.find((a) => a.id === d.ageBand)?.label ?? d.ageBand;
  const modelRows = [
    { role: "Smart model", detail: "Audits each chat and writes the cross-conversation summary", value: models.smart },
    { role: "Fast model", detail: "Classifies browsing history items", value: models.fast },
    { role: "Moderation", detail: "OpenAI Moderation API, run on every history item and child message", value: models.moderation },
  ];

  return (
    <FadeUp inView className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* dataset */}
        <div className="nl-card p-6">
          <span className="grid size-10 place-items-center rounded-2xl bg-muted text-foreground/80">
            <Database className="size-5" />
          </span>
          <h3 className="text-title mt-4 text-lg">The dataset</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            One synthetic child, {d.child}, aged {age.replace(" years", "")}, with <span className="tabular-nums">{fmtNum(d.days)}</span> days
            of browsing and AI chats. We wrote it, so every label is known. No real child’s data was used.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Fact label="days covered" value={fmtNum(d.days)} />
            <Fact label="page visits" value={fmtNum(d.visits)} />
            <Fact label="unique pages" value={fmtNum(d.uniquePages)} />
            <Fact label="conversations" value={fmtNum(d.conversations)} />
            <Fact label="planted items" value={fmtNum(d.plantedSignals)} />
            <Fact label="harmless items" value={fmtNum(d.benignItems)} />
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            <span className="tabular-nums">{fmtNum(d.benignConversations)}</span> of the conversations are ordinary and
            should raise nothing.
            {normalControls > 0 && (
              <>
                {" "}
                <span className="tabular-nums">{fmtNum(normalControls)}</span> of the planted items{" "}
                {normalControls === 1 ? "is a normal control" : "are normal controls"} that must be left alone.
              </>
            )}
          </p>
        </div>

        {/* labels */}
        <div className="nl-card p-6">
          <span className="grid size-10 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <FileCheck2 className="size-5" />
          </span>
          <h3 className="text-title mt-4 text-lg">How the labels were made</h3>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">
            The answer key was written from the dataset’s design, before any method was run on it. For each planted item
            it records the dimension, the lowest severity that counts, and which neighbouring dimensions are also accepted.
          </p>
          <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-foreground/85">
            <li className="flex gap-2.5">
              <ListChecks className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                <strong className="font-semibold">Caught</strong> means the method raised the item in an accepted dimension.
                <strong className="font-semibold"> Right severity</strong> also needs it at or above the key’s level.
              </span>
            </li>
            <li className="flex gap-2.5">
              <Scale className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                Normal controls count as correct only when <strong className="font-semibold">left alone</strong>.
                Patterns follow the written rule shown with each one above.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* limitations */}
      <div className="nl-card border-[color-mix(in_oklab,var(--glow)_35%,var(--border))] bg-[color-mix(in_oklab,var(--glow)_8%,var(--card))] p-6">
        <div className="flex items-center gap-3">
          <TriangleAlert className="size-5 text-[var(--glow-ink)]" />
          <h3 className="text-title text-lg">What this does not show</h3>
        </div>
        {limitations.length > 0 ? (
          <ul className="mt-4 space-y-2.5">
            {limitations.map((l) => (
              <li key={l} className="flex gap-3 text-sm leading-relaxed text-foreground/90">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--glow-ink)]" />
                {l}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No limitations were recorded in this results file.</p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* models */}
        <div className="nl-card p-6">
          <span className="grid size-10 place-items-center rounded-2xl bg-muted text-foreground/80">
            <Brain className="size-5" />
          </span>
          <h3 className="text-title mt-4 text-lg">Models used</h3>
          <ul className="mt-4 divide-y divide-border">
            {modelRows.map((m) => (
              <li key={m.role} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{m.role}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{m.detail}</p>
                </div>
                <code className="shrink-0 rounded-md bg-muted px-2 py-1 font-mono text-xs">{m.value}</code>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            The baselines are <span className="font-medium text-foreground/80">{METHOD_META.moderation.name}</span> and{" "}
            <span className="font-medium text-foreground/80">{METHOD_META.single_chat.name.toLowerCase()}</span>. The full
            pipeline ran <span className="tabular-nums">{fmtNum(runs)}</span> times.
          </p>
        </div>

        {/* reproduce */}
        <div className="nl-card p-6">
          <span className="grid size-10 place-items-center rounded-2xl bg-muted text-foreground/80">
            <Terminal className="size-5" />
          </span>
          <h3 className="text-title mt-4 text-lg">Reproduce it</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The dataset, the answer key and the scoring are all in the repository. This command re-runs the evaluation and
            rewrites the numbers on this page.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-foreground px-4 py-3 font-mono text-sm text-background">
            <code>npm run eval</code>
          </pre>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <ExtLink href={ANSWER_KEY_URL}>Answer key (eval/answer-key.ts)</ExtLink>
            <ExtLink href={WRITE_UP_URL}>Write-up (docs/evaluation.md)</ExtLink>
          </div>
        </div>
      </div>
    </FadeUp>
  );
}
