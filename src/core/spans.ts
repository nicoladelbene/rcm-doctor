import type { Control, ControlField, Span } from "./schema";

/**
 * Locate a quoted snippet inside a control field and return a verified span.
 * Returns null when the quote does not appear in the source — we never show an
 * unverifiable citation. Matching is exact first, then case-insensitive, then
 * tolerant to whitespace and quote-character differences.
 */
export function locateSpan(control: Control, field: ControlField, quote: string | null | undefined): Span | null {
  if (!quote) return null;
  const source = String(control[field] ?? "");
  const q = quote.trim().replace(/^["'“”‘’]+|["'“”‘’.]+$/g, "");
  if (!q || !source) return null;

  let start = source.indexOf(q);
  if (start < 0) start = source.toLowerCase().indexOf(q.toLowerCase());
  if (start >= 0) return { field, text: source.slice(start, start + q.length), start, end: start + q.length };

  // Whitespace / punctuation tolerant match: build a regex from the quote's tokens.
  const tokens = q.split(/\s+/).filter(Boolean).map(escapeRe);
  if (tokens.length === 0) return null;
  const re = new RegExp(tokens.join("[\\s\\u00a0]+").replace(/["'“”‘’]/g, "[\"'“”‘’]"), "i");
  const m = re.exec(source);
  if (!m) return null;
  return { field, text: m[0], start: m.index, end: m.index + m[0].length };
}

export function spanAt(field: ControlField, source: string, start: number, end: number): Span {
  return { field, text: source.slice(start, end), start, end };
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
