import { GradeChip, VerdictIcon } from "@/components/evaluation/eval-ui";
import { FadeUp } from "@/components/motion";
import type { EvalResults } from "@/lib/eval-types";
import { AI_RESPONSE_META } from "@/lib/rubric";

export function AiGrades({ results }: { results: EvalResults }) {
  const { aiGrades, runs } = results;
  const cols = Math.max(runs, ...aiGrades.map((g) => g.got.length), 0);

  if (aiGrades.length === 0) {
    return (
      <div className="nl-card p-6 text-sm text-muted-foreground">No AI replies were graded in this results file.</div>
    );
  }

  return (
    <FadeUp>
      <div className="nl-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <caption className="sr-only">
              For each conversation, the grade we expected for the AI’s replies and the grade Nightlight gave in each run.
            </caption>
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground">
                <th scope="col" className="w-[32%] px-5 py-3 font-medium">
                  Conversation and why
                </th>
                <th scope="col" className="px-3 py-3 font-medium">
                  Accepted grade
                </th>
                {Array.from({ length: cols }, (_, i) => (
                  <th key={i} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                    Nightlight, run {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aiGrades.map((g, row) => (
                <tr key={`${g.convTitle}-${row}`} className="border-t border-border align-top">
                  <th scope="row" className="px-5 py-4 text-left font-normal">
                    <span className="block text-sm leading-snug font-medium">{g.convTitle}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{g.platform}</span>
                    <span className="mt-2 block text-xs leading-relaxed text-muted-foreground text-pretty">{g.why}</span>
                  </th>
                  <td className="px-3 py-4">
                    <ul className="flex flex-col items-start gap-1.5">
                      {g.expected.map((e, i) => (
                        <li key={e} className="flex flex-col items-start gap-1">
                          {i > 0 && <span className="pl-1 text-[0.68rem] text-muted-foreground">or</span>}
                          <GradeChip grade={e} />
                        </li>
                      ))}
                    </ul>
                  </td>
                  {Array.from({ length: cols }, (_, i) => {
                    const got = g.got[i];
                    if (!got) {
                      return (
                        <td key={i} className="px-3 py-4 text-xs text-muted-foreground">
                          No grade
                        </td>
                      );
                    }
                    const ok = g.expected.includes(got);
                    return (
                      <td key={i} className="px-3 py-4">
                        <span className="flex items-start gap-2">
                          <VerdictIcon kind={ok ? "check" : "cross"} tone={ok ? "good" : "bad"} className="mt-0.5" />
                          <span className="min-w-0">
                            <span className="block text-xs font-medium">{AI_RESPONSE_META[got].label}</span>
                            <span className="block text-[0.68rem] text-muted-foreground">
                              {ok ? "As expected" : "Not an accepted grade"}
                            </span>
                          </span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </FadeUp>
  );
}
