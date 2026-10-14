// Compile-time check that data/eval-results.json still has the shape of lib/eval-types.ts (`npx tsc --noEmit`).
// JSON imports widen string literals to `string` and tuples to arrays, so enum members and tuple lengths are
// checked at runtime by assertShape() in scripts/eval.ts; this check catches missing keys and wrong value types.
import raw from "../data/eval-results.json";
import type { EvalResults } from "../lib/eval-types";

type Loose<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? Loose<U>[]
    : T extends object
      ? { [K in keyof T]: Loose<T[K]> }
      : T;

export const evalResultsShapeCheck: Loose<EvalResults> = raw;
