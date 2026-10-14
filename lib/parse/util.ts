// Small helpers shared by the parsers. Everything here runs in the browser and in Node.

/** Offset between the WebKit epoch (1601-01-01) and the Unix epoch, in ms. */
export const WEBKIT_EPOCH_OFFSET_MS = 11_644_473_600_000;
/** Offset between the Apple "Cocoa" epoch (2001-01-01) and the Unix epoch, in seconds. */
export const COCOA_EPOCH_OFFSET_S = 978_307_200;

const IGNORED_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "chrome-search://",
  "chrome-untrusted://",
  "chrome-error://",
  "edge://",
  "brave://",
  "opera://",
  "vivaldi://",
  "about:",
  "file:",
  "moz-extension:",
  "place:",
  "data:",
  "blob:",
  "javascript:",
  "view-source:",
  "devtools:",
];

/** Internal browser pages and local files are not "browsing" – skip them. */
export function isIgnoredUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  const u = url.trim().toLowerCase();
  if (!u) return true;
  return IGNORED_URL_PREFIXES.some((p) => u.startsWith(p));
}

/** Tiny, fast, stable string hash (cyrb53) -> base36. Used for ids, not security. */
export function hashString(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Best-effort conversion of "a time" to ms since the Unix epoch.
 * Accepts ISO / locale date strings, seconds, milliseconds, microseconds,
 * WebKit microseconds (Chrome) and nanoseconds.
 */
export function toMs(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  let n: number;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string") {
    const s = value.trim();
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      n = Number(s);
    } else {
      const t = Date.parse(s);
      return Number.isFinite(t) ? t : null;
    }
  } else {
    return null;
  }
  if (!Number.isFinite(n) || n <= 0) return null;
  let ms: number;
  if (n >= 1e17) ms = n / 1e6; // nanoseconds
  else if (n >= 1e16) ms = n / 1000 - WEBKIT_EPOCH_OFFSET_MS; // WebKit microseconds
  else if (n >= 1e14) ms = n / 1000; // Unix microseconds
  else if (n >= 1e11) ms = n; // milliseconds
  else ms = n * 1000; // seconds
  return Math.round(ms);
}

/** Decode a file's bytes as text (UTF-8, UTF-16 with BOM), stripping a BOM. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }
  return new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
}

/** True if the first bytes are the SQLite file header "SQLite format 3\0". */
export function hasSqliteHeader(bytes: Uint8Array): boolean {
  const magic = "SQLite format 3\0";
  if (bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic.charCodeAt(i)) return false;
  }
  return true;
}
