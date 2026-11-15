import { Fragment } from "react";

export type CiteKind = "fail" | "weak" | "ok";
export interface Cite {
  start: number;
  end: number;
  kind: CiteKind;
  label: string;
  /** Footnote number for findings (shown as superscript). */
  n?: number;
}

const PRIORITY: Record<CiteKind, number> = { fail: 3, weak: 2, ok: 1 };

/**
 * Render text with cited spans. Overlaps resolve by priority (fail > weak > ok),
 * so a finding is never hidden behind a pass marker.
 */
export function Highlighted({ text, cites, active }: { text: string; cites: Cite[]; active?: number | null }) {
  if (!text) return <span className="italic text-muted">(empty)</span>;
  const owner: (number | -1)[] = new Array(text.length).fill(-1);
  cites.forEach((c, i) => {
    for (let k = Math.max(0, c.start); k < Math.min(text.length, c.end); k++) {
      const cur = owner[k];
      if (cur === -1 || PRIORITY[cites[cur].kind] < PRIORITY[c.kind]) owner[k] = i;
    }
  });
  const segs: { from: number; to: number; cite: number }[] = [];
  for (let k = 0; k < text.length; k++) {
    const last = segs[segs.length - 1];
    if (last && last.cite === owner[k]) last.to = k + 1;
    else segs.push({ from: k, to: k + 1, cite: owner[k] });
  }
  return (
    <>
      {segs.map((s, i) => {
        const t = text.slice(s.from, s.to);
        if (s.cite < 0) return <Fragment key={i}>{t}</Fragment>;
        const c = cites[s.cite];
        const isEnd = s.to === Math.min(text.length, c.end);
        return (
          <Fragment key={i}>
            <mark className={`cite cite-${c.kind} ${active != null && c.n === active ? "is-active" : ""}`} title={c.label} data-cite={c.n ?? ""}>
              {t}
            </mark>
            {isEnd && c.n != null && (
              <sup className={`ml-px font-mono text-[10px] font-medium ${c.kind === "fail" ? "text-fail" : "text-weak"}`}>{c.n}</sup>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

/** Render a rewrite with [placeholders] marked, so reviewers see what still needs input. */
export function WithPlaceholders({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <span key={i} className="rounded-[3px] border border-dashed border-accent/50 bg-accent-soft px-1 font-medium text-accent-ink">
            {p}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
