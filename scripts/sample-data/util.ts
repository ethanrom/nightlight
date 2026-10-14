// Shared helpers for the synthetic demo-data generator. Everything is deterministic (seeded).

export interface Rng {
  next(): number;
  /** inclusive */
  int(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  alnum(len: number): string;
}

/** mulberry32 – tiny seeded PRNG. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    alnum: (len) => {
      let s = "";
      for (let i = 0; i < len; i++) s += chars[Math.floor(next() * chars.length)];
      return s;
    },
  };
}

/** Stable uuid-shaped id derived from a label (so history and chat exports can reference the same ids). */
export function uuidFrom(label: string): string {
  const rng = makeRng(hash32(label));
  const hex = (n: number) => {
    let s = "";
    for (let i = 0; i < n; i++) s += Math.floor(rng.next() * 16).toString(16);
    return s;
  };
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(rng.next() * 4)]}${hex(3)}-${hex(12)}`;
}

export function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Wall-clock time encoded as UTC (ms), e.g. at(10, 10, 1, 40) is 2026-10-10T01:40:00Z.
 * The demo files are "floating" wall-clock times: lib/pipeline.ts re-anchors them to the viewer's
 * timezone (shiftTimestampsMs = getTimezoneOffset()), so Maya's 1am chats are 1am wherever the demo is opened.
 * It also makes the generated files byte-identical on every machine.
 */
export function at(month: number, day: number, hour: number, minute = 0, second = 0): number {
  return Date.UTC(2026, month - 1, day, hour, minute, second);
}

export function hm(s: string): [number, number] {
  const [h, m] = s.split(":").map(Number);
  return [h, m];
}
