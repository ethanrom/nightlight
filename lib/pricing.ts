// Rough cost accounting for Bedrock calls, used for the public demo's spend limits and for logs.
// Prices are USD per million tokens (list prices for Claude Haiku 5.5 / Sonnet 5.5). Bedrock bills partner models
// separately and can differ, so estimates are inflated by PRICE_MULTIPLIER (default 1.25) to stay conservative.

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

interface Price {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  /** Haiku 5.5 charges more for prompts over 100K tokens */
  longInput?: number;
  longOutput?: number;
}

const HAIKU: Price = { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01, longInput: 0.5, longOutput: 2.5 };
const SONNET: Price = { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 };

export function priceFor(model: string): Price {
  return /haiku/i.test(model) ? HAIKU : SONNET;
}

export function costMultiplier(): number {
  const m = Number(process.env.PRICE_MULTIPLIER);
  return Number.isFinite(m) && m > 0 ? m : 1.25;
}

/** Estimated USD for one call, including the safety multiplier. */
export function costUsd(model: string, usage: Usage): number {
  const p = priceFor(model);
  const fresh = usage.input_tokens ?? 0;
  const cacheW = usage.cache_creation_input_tokens ?? 0;
  const cacheR = usage.cache_read_input_tokens ?? 0;
  const long = p.longInput !== undefined && fresh + cacheW + cacheR > 100_000;
  const inRate = long ? p.longInput! : p.input;
  const outRate = long ? p.longOutput! : p.output;
  const usd =
    (fresh * inRate + cacheW * p.cacheWrite + cacheR * p.cacheRead + (usage.output_tokens ?? 0) * outRate) / 1_000_000;
  return usd * costMultiplier();
}
