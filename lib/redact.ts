// Local PII detection + redaction. Runs in the browser BEFORE anything is sent to the model.
// Replaces emails, phone numbers, street addresses, school names and social handles with [TOKENS],
// and returns masked previews of what was found (never the raw value) so the parent can see it.
import type { PiiType } from "./types";

export interface RedactionHit {
  type: PiiType;
  /** masked preview, e.g. "address 4• M•••• Street" */
  preview: string;
}

export interface RedactionResult {
  text: string;
  hits: RedactionHit[];
}

// ---------------------------------------------------------------- masking helpers

const BULLET = "•";

/** "Maple" -> "M••••", "42" -> "4•". */
function maskToken(tok: string): string {
  if (tok.length <= 1) return tok;
  return tok[0] + BULLET.repeat(Math.min(tok.length - 1, 8));
}

/** Mask every word/number but keep the separators and any words in `keep` (e.g. "Street"). */
function maskWords(value: string, keep: RegExp | null = null): string {
  return value.replace(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu, (w) => (keep && keep.test(w) ? w : maskToken(w)));
}

function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${maskToken(local)}@${maskToken(host)}${tld}`;
}

/** Keep the shape ("••••• ••••••") but none of the digits – even an area code narrows down a location. */
function maskPhone(phone: string): string {
  return phone.replace(/\d/g, BULLET);
}

function maskHandle(handle: string): string {
  const bare = handle.replace(/^@/, "");
  return "@" + maskToken(bare);
}

// ---------------------------------------------------------------- patterns

// Quantifiers are bounded (RFC limits: 64-char local part, 63-char labels) so long runs of text stay linear-time.
const EMAIL_RE = /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,6}\.[A-Za-z]{2,24}/g;

// 2-5 digit groups split by a single space/dot/dash (or one 9-11 digit run), optional +country and (area) code.
const PHONE_RE = /(?<![\w@/.-])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,5}\)[\s.-]?)?(?:\d{2,6}(?:[\s.-]\d{2,6}){1,5}|\d{9,11})(?!\w)/g;
const DATE_PREFIX = /^\d{4}[-/. ]\d{1,2}[-/. ]\d{1,2}|^\d{1,2}[-/. ]\d{1,2}[-/. ]\d{2,4}$/;

const ADDRESS_STOP =
  "the|a|an|of|on|in|at|my|our|your|to|and|i|it|is|was|for|with|from|by|near|next|every|this|that|these|those|some|other|more|few|many|days|weeks|hours|minutes|times|years|months|people|friends|kids|first|second|third|last";
const ADDRESS_RE = new RegExp(
  `\\b(\\d{1,5}[A-Za-z]?)\\s+((?:(?!(?:${ADDRESS_STOP})\\b)[A-Za-z][A-Za-z'’-]*\\s+){1,3}?)` +
    `(Street|Road|Avenue|Lane|Crescent|Boulevard|Terrace|Gardens|Drive|Close|Court|Place|Way|St|Rd|Ave|Ln|Dr|Ct|Pl|Blvd)\\b`,
  "gi",
);
/** Suffixes that are also ordinary English words / abbreviations: only treat them as a street if capitalised. */
const CAPITALISED_SUFFIX = /^(drive|close|court|place|way|terrace|gardens|st|rd|ave|ln|dr|ct|pl|blvd)$/i;

const SCHOOL_NOT_NAME =
  "the|a|an|my|our|your|his|her|their|this|that|new|old|same|different|other|another|high|middle|primary|secondary|elementary|junior|senior|boarding|home|summer|sunday|night|public|private|state|local|good|bad|big|small|every|each|some|any|no|school|college|academy|prep|near|by|after|before|during|until|since|because|about|around|behind|beside|outside|inside|with|without|to|at|in|on|of|for|from|and|or|but|so|if|i";
const SCHOOL_SUFFIX_CI =
  "(?:high|middle|secondary|primary|grammar|elementary|junior|senior)\\s+school|school|academy|college|high|prep";
// "I go to westbrook middle school" (any case, needs a clear attending verb)
const SCHOOL_VERB_RE = new RegExp(
  `\\b(?:go(?:es)?|going|went|attend(?:s|ed|ing)?|stud(?:y|ies|ied|ying)|enrolled)\\s+(?:(?:to|at|in)\\s+)?(?:the\\s+)?` +
    `((?:(?!(?:${SCHOOL_NOT_NAME})\\b)[A-Za-z][A-Za-z'’.-]*\\s+){1,2}?(?:${SCHOOL_SUFFIX_CI}))\\b`,
  "gi",
);
// "at Westbrook High School" (proper nouns only)
const CAP_STOP =
  "The|My|Our|Your|His|Her|Their|This|That|A|An|At|In|On|To|If|I|And|But|So|Sunday|Summer|Winter|After|Before|High|Middle|Primary|Secondary|Junior|Senior|Home|Boarding|Night|Evening|Weekend|Public|Private|Old|New|Good|Bad";
const SCHOOL_AT_RE = new RegExp(
  `\\b(?:at|from|to|in|for)\\s+(?:the\\s+)?` +
    `((?:(?!(?:${CAP_STOP})\\b)[A-Z][A-Za-z'’.-]*)(?:\\s+(?!(?:${CAP_STOP})\\b)[A-Z][A-Za-z'’.-]*){0,2}\\s+` +
    `(?:(?:High|Middle|Secondary|Primary|Grammar|Elementary|Junior|Senior)\\s+School|School|Academy|College|High))\\b`,
  "g",
);
const SCHOOL_KEEP_WORDS = /^(school|high|middle|secondary|primary|grammar|elementary|junior|senior|academy|college|prep)$/i;

const LABELLED_HANDLE_RE =
  /\b((?:snap(?:chat)?|insta(?:gram)?|ig|tiktok|discord|kik|telegram|whatsapp|username|user name)\s*(?:is|:|=|-|name is|handle is)\s*)(@?[A-Za-z0-9_.]{4,30})(?![\w@])/gi;
const HANDLE_RE = /(?<![\w@.])@[A-Za-z0-9_]{3,30}(?:\.[A-Za-z0-9_]{1,30})*/g;

// ---------------------------------------------------------------- main

/** Redact PII in free text and report what was found (masked). */
export function redact(input: string): RedactionResult {
  if (!input) return { text: input ?? "", hits: [] };
  const hits: RedactionHit[] = [];
  let text = input;

  // 1) emails (before handles, so the "@" inside them isn't taken for a handle)
  text = text.replace(EMAIL_RE, (m) => {
    hits.push({ type: "email", preview: `email ${maskEmail(m)}` });
    return "[EMAIL]";
  });

  // 2) phone numbers
  text = text.replace(PHONE_RE, (m) => {
    const digits = m.replace(/\D/g, "").length;
    if (digits < 9 || digits > 15) return m;
    if (DATE_PREFIX.test(m.trim())) return m;
    hits.push({ type: "phone", preview: `phone number ${maskPhone(m)}` });
    return "[PHONE]";
  });

  // 3) street addresses
  text = text.replace(ADDRESS_RE, (m, num: string, name: string, suffix: string) => {
    if (CAPITALISED_SUFFIX.test(suffix) && suffix[0] !== suffix[0].toUpperCase()) return m;
    hits.push({ type: "address", preview: `address ${maskWords(`${num} ${name.trim()}`)} ${suffix}` });
    return "[ADDRESS]";
  });

  // 4) schools
  const schoolSub = (m: string, name: string) => {
    hits.push({ type: "school", preview: `school ${maskWords(name, SCHOOL_KEEP_WORDS)}` });
    return m.slice(0, m.length - name.length) + "[SCHOOL]";
  };
  text = text.replace(SCHOOL_VERB_RE, schoolSub);
  text = text.replace(SCHOOL_AT_RE, schoolSub);

  // 5) social handles ("snap is maya_k14", then bare @handles)
  text = text.replace(LABELLED_HANDLE_RE, (m, label: string, handle: string) => {
    // Plain words ("snap is great") are not handles – need an @, digit, underscore or dot.
    if (!/[@\d_.]/.test(handle)) return m;
    hits.push({ type: "social_handle", preview: `social handle ${maskHandle(handle)}` });
    return `${label}[HANDLE]`;
  });
  text = text.replace(HANDLE_RE, (m) => {
    hits.push({ type: "social_handle", preview: `social handle ${maskHandle(m)}` });
    return "[HANDLE]";
  });

  return { text, hits };
}

/** Redact and drop the hits – for page titles, search queries, etc. */
export function redactText(input: string): string {
  return redact(input).text;
}
