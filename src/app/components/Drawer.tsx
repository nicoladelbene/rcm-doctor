"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ATTRIBUTE_CHECKS,
  CHECK_LABELS,
  RULE_CHECKS,
  type Control,
  type Finding,
  type Review,
} from "@/core/schema";
import { AutomationMeter, SeverityTag, StatusGlyph, StatusPill } from "./bits";
import { Highlighted, WithPlaceholders, type Cite } from "./Highlighted";
import type { TestScript } from "@/core/testscript";
import { TestScriptPanel } from "./TestScriptPanel";

export type DrawerTab = "review" | "test";

/** Phrased as the property being checked, so a ✓ reads naturally. */
const RULE_PASS_LABEL: Record<(typeof RULE_CHECKS)[number], string> = {
  freq_mismatch: "Frequency consistent with column",
  nature_mismatch: "Nature consistent with description",
  owner_invalid: "Owner is a role",
  sod_conflict: "Segregation of duties",
  missing_risk_link: "Linked to a risk and objective",
  key_no_evidence: "Key control has evidence defined",
};

const ATTR_HINT: Record<(typeof ATTRIBUTE_CHECKS)[number], string> = {
  who: "Performer named as a role",
  what: "Concrete, testable action",
  when: "Timing or trigger event",
  frequency: "Stated and plausible",
  evidence: "What is retained, and where",
  precision: "Threshold or investigation criterion",
};

export function Drawer({
  control,
  review,
  onClose,
  onPrev,
  onNext,
  position,
  script,
  tab = "review",
  onTab,
  refs,
}: {
  control: Control;
  review: Review;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position: string;
  script?: TestScript;
  tab?: DrawerTab;
  onTab?: (t: DrawerTab) => void;
  /** Week 6: verified framework references (AI systems controls pack). */
  refs?: { euAiAct: string; iso42001: string; nistAiRmf: string; finma: string };
}) {
  // Hovered finding number, scoped to the control it was set on (resets on navigation without an effect).
  const [hover, setHover] = useState<{ id: string; n: number } | null>(null);
  const active = hover?.id === control.control_id ? hover.n : null;
  const setActive = (n: number | null) => setHover(n == null ? null : { id: control.control_id, n });
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    panelRef.current?.scrollTo({ top: 0 });
  }, [control.control_id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.key === "ArrowDown" || e.key === "j") && onNext) {
        e.preventDefault();
        onNext();
      }
      if ((e.key === "ArrowUp" || e.key === "k") && onPrev) {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev]);

  // Number findings in reading order; build cites for each field.
  const numbered = useMemo(() => {
    const withSpan = review.findings
      .map((f, i) => ({ f, i }))
      .sort((a, b) => (a.f.evidence_span?.start ?? 1e9) - (b.f.evidence_span?.start ?? 1e9));
    const n = new Map<Finding, number>();
    withSpan.forEach(({ f }, k) => n.set(f, k + 1));
    return n;
  }, [review.findings]);

  const citesFor = (field: keyof Control): Cite[] => {
    const cites: Cite[] = [];
    for (const f of review.findings)
      if (f.evidence_span?.field === field)
        cites.push({
          start: f.evidence_span.start,
          end: f.evidence_span.end,
          kind: f.severity === "high" ? "fail" : "weak",
          label: `${CHECK_LABELS[f.check]}: ${f.message}`,
          n: numbered.get(f),
        });
    if (field === "control_description")
      for (const a of review.attributes)
        if (a.ok && a.span) cites.push({ start: a.span.start, end: a.span.end, kind: "ok", label: `${CHECK_LABELS[a.check]} ✓` });
    return cites;
  };

  const ruleFails = new Map(review.findings.filter((f) => f.source === "rule").map((f) => [f.check, f]));
  const attrFinding = new Map(review.findings.filter((f) => f.source === "llm").map((f) => [f.check, f]));
  const attrRes = new Map(review.attributes.map((a) => [a.check, a]));
  const hasLlm = review.model !== "rules-only";
  const ordered = [...review.findings].sort((a, b) => (numbered.get(a) ?? 0) - (numbered.get(b) ?? 0));
  const ownerCites = citesFor("control_owner");

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <button type="button" aria-label="Close details" onClick={onClose} className="anim-fade absolute inset-0 cursor-default bg-ink/25" />
      <div
        ref={panelRef}
        data-testid="drawer"
        className="anim-drawer relative flex h-full w-full max-w-[880px] flex-col overflow-y-auto border-l border-rule-strong bg-paper shadow-[0_0_40px_rgba(22,25,29,0.18)]"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-rule bg-paper/95 px-6 py-4 backdrop-blur sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 id="drawer-title" className="font-mono text-[17px] font-medium text-ink">
                  {control.control_id}
                </h2>
                <StatusPill status={review.status} size="md" />
                {control.key_control && (
                  <span className="rounded-[4px] border border-ink-2/30 px-1.5 py-px text-[11px] font-semibold uppercase tracking-wide text-ink-2">Key control</span>
                )}
              </div>
              <div className="mt-1 truncate text-[13px] text-muted">
                {[control.process, control.sub_process].filter(Boolean).join(" / ")}
                {control.risk_id && <span> · Risk {control.risk_id}</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="mr-2 hidden font-mono text-[12px] text-muted sm:inline">{position}</span>
              <IconBtn label="Previous control (↑)" onClick={onPrev} disabled={!onPrev}>
                <path d="M4 10l4-4 4 4" />
              </IconBtn>
              <IconBtn label="Next control (↓)" onClick={onNext} disabled={!onNext}>
                <path d="M4 6l4 4 4-4" />
              </IconBtn>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="ml-1 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-sunken"
              >
                Close <span className="text-muted">Esc</span>
              </button>
            </div>
          </div>
          {onTab && (
            <div className="-mb-4 mt-3 flex gap-5 text-[13.5px]" role="tablist">
              {(
                [
                  ["review", "Design review"],
                  ["test", "Test script"],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  data-testid={`tab-${t}`}
                  onClick={() => onTab(t)}
                  className={`border-b-2 pb-2 font-medium transition-colors ${tab === t ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
                >
                  {label}
                  {t === "test" && script && (
                    <span className={`ml-1.5 rounded-full px-1.5 text-[11px] ${script.toe_ready ? "bg-pass-soft text-pass" : "bg-fail-soft text-fail"}`}>
                      {script.toe_ready ? `n=${script.sample.size}` : "blocked"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === "test" ? (
          <div className="px-6 py-6 sm:px-8">
            <TestScriptPanel control={control} script={script} />
          </div>
        ) : (
        <div className="space-y-8 px-6 py-6 sm:px-8">
          {refs && <FrameworkRefs refs={refs} />}
          {/* Description with cited spans */}
          <section>
            <SectionTitle>Control description</SectionTitle>
            <p data-testid="drawer-description" className="mt-2 rounded-md border border-rule bg-surface px-4 py-3.5 font-serif text-[16.5px] leading-[1.75] text-ink">
              <Highlighted text={control.control_description} cites={citesFor("control_description")} active={active} />
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted">
              <Legend cls="cite-fail">high-severity finding</Legend>
              <Legend cls="cite-weak">medium / low finding</Legend>
              <Legend cls="cite-ok">attribute present</Legend>
              <span>Spans are verified against the source text.</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-[13px] sm:grid-cols-4">
              <Meta k="Owner">
                {control.control_owner ? <Highlighted text={control.control_owner} cites={ownerCites} active={active} /> : <span className="italic text-fail">empty</span>}
              </Meta>
              <Meta k="Frequency">{control.frequency || <span className="italic text-muted">—</span>}</Meta>
              <Meta k="Type / nature">
                {[control.control_type, control.nature].filter(Boolean).join(" · ") || "—"}
              </Meta>
              <Meta k="Evidence (column)">{control.evidence || <span className="italic text-muted">—</span>}</Meta>
            </dl>
          </section>

          {/* Findings */}
          <section>
            <SectionTitle count={review.findings.length}>Findings</SectionTitle>
            {ordered.length === 0 ? (
              <p className="mt-2 text-[14px] text-muted">No findings. This control passes all applicable checks.</p>
            ) : (
              <ol className="mt-2 divide-y divide-rule overflow-hidden rounded-md border border-rule bg-surface">
                {ordered.map((f) => {
                  const n = numbered.get(f)!;
                  return (
                    <li
                      key={`${f.check}-${n}`}
                      onMouseEnter={() => setActive(n)}
                      onMouseLeave={() => setActive(null)}
                      className="grid grid-cols-[28px_1fr] gap-x-2 px-4 py-3 transition-colors hover:bg-sunken/50"
                    >
                      <span className={`font-mono text-[12px] font-medium leading-6 ${f.severity === "high" ? "text-fail" : "text-weak"}`}>{n}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="text-[14px] font-semibold text-ink">{CHECK_LABELS[f.check]}</span>
                          <SeverityTag severity={f.severity} />
                          <span className="text-[11px] uppercase tracking-wide text-muted">{f.source === "rule" ? "rule" : "AI review"}</span>
                        </div>
                        <p className="mt-0.5 text-[14px] text-ink-2">{f.message}</p>
                        <p className="mt-1 text-[12.5px] text-muted">
                          {f.evidence_span ? (
                            <>
                              Cited from <span className="font-mono">{f.evidence_span.field}</span> [{f.evidence_span.start}–{f.evidence_span.end}]:{" "}
                              <q className="font-serif text-[13.5px] text-ink-2">{f.evidence_span.text}</q>
                            </>
                          ) : (
                            <>Missing from the text — nothing to cite.</>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Checklists */}
          <section className="grid gap-6 md:grid-cols-[1.35fr_1fr]">
            <div>
              <SectionTitle>Design attributes {hasLlm ? "" : "(needs an AI run)"}</SectionTitle>
              <ul className="mt-2 divide-y divide-rule rounded-md border border-rule bg-surface">
                {ATTRIBUTE_CHECKS.map((c) => {
                  const f = attrFinding.get(c);
                  const a = attrRes.get(c);
                  const status = !hasLlm ? null : f ? (f.severity === "high" ? "fail" : "weak") : "pass";
                  return (
                    <li key={c} className="flex items-start gap-3 px-3.5 py-2.5">
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          status === "pass" ? "bg-pass-soft text-pass" : status === "fail" ? "bg-fail-soft text-fail" : status === "weak" ? "bg-weak-soft text-weak" : "bg-sunken text-muted"
                        }`}
                      >
                        {status ? <StatusGlyph status={status} /> : <span className="text-[10px]">–</span>}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-medium text-ink">
                          {CHECK_LABELS[c].split(" — ")[0]} <span className="font-normal text-muted">· {ATTR_HINT[c]}</span>
                        </div>
                        {status === "pass" && a?.span && (
                          <div className="truncate font-serif text-[13px] text-ink-2">“{a.span.text}”</div>
                        )}
                        {status === "pass" && !a?.span && <div className="text-[12.5px] text-muted">Present (or not applicable)</div>}
                        {f && <div className="text-[12.5px] text-ink-2">{f.message}</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <SectionTitle>Consistency rules</SectionTitle>
              <ul className="mt-2 divide-y divide-rule rounded-md border border-rule bg-surface">
                {RULE_CHECKS.map((c) => {
                  const f = ruleFails.get(c);
                  return (
                    <li key={c} className="flex items-center gap-3 px-3.5 py-2.5">
                      <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${f ? (f.severity === "high" ? "bg-fail-soft text-fail" : "bg-weak-soft text-weak") : "bg-pass-soft text-pass"}`}>
                        <StatusGlyph status={f ? (f.severity === "high" ? "fail" : "weak") : "pass"} />
                      </span>
                      <span className="text-[13.5px] text-ink">{RULE_PASS_LABEL[c]}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[12px] text-muted">Deterministic checks, no AI involved.</p>
            </div>
          </section>

          {/* Rewrite */}
          <section>
            <SectionTitle>Suggested rewrite</SectionTitle>
            {review.suggested_rewrite ? (
              <div className="mt-2 grid overflow-hidden rounded-md border border-rule md:grid-cols-2" data-testid="rewrite">
                <div className="border-b border-rule bg-sunken/40 p-4 md:border-r md:border-b-0">
                  <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted">Original</div>
                  <p className="font-serif text-[15px] leading-[1.7] text-ink-2">{control.control_description}</p>
                </div>
                <div className="bg-surface p-4">
                  <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-accent">Rewrite · drafted to meet all six attributes</div>
                  <p className="font-serif text-[15px] leading-[1.7] text-ink">
                    <WithPlaceholders text={review.suggested_rewrite} />
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[14px] text-muted">Rewrites need an AI run (add an OpenRouter key when uploading).</p>
            )}
            {review.suggested_rewrite.includes("[") && (
              <p className="mt-2 text-[12px] text-muted">
                <span className="rounded-[3px] border border-dashed border-accent/50 bg-accent-soft px-1 text-accent-ink">[placeholders]</span> mark facts the
                original does not state. Nothing material is invented.
              </p>
            )}
          </section>

          {/* Automation */}
          <section className="rounded-md border border-rule bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle>Automation potential</SectionTitle>
              <AutomationMeter score={review.automation_score} size="md" />
            </div>
            <p className="mt-1.5 text-[14px] text-ink-2">{review.automation_rationale}</p>
            <p className="mt-1 text-[12px] text-muted">0 = pure judgment · 3 = rules-based, scriptable · 5 = system-enforceable (ITAC candidate)</p>
          </section>

          <footer className="border-t border-rule pt-4 pb-2 text-[12px] text-muted">
            Reviewed by <span className="font-mono">{review.model}</span> · prompt <span className="font-mono">{review.prompt_version}</span>
            {review.llm_error && <span className="text-fail"> · AI step failed: {review.llm_error} (rules shown only)</span>}
          </footer>
        </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h3 className="text-[12px] font-semibold uppercase tracking-[0.09em] text-ink-2">
      {children}
      {count != null && <span className="ml-1.5 font-mono font-medium text-muted">{count}</span>}
    </h3>
  );
}

function Meta({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] uppercase tracking-[0.07em] text-muted">{k}</dt>
      <dd className="mt-0.5 text-ink-2">{children}</dd>
    </div>
  );
}

function Legend({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <mark className={`cite ${cls} px-1.5 text-[11px]`}>abc</mark>
      {children}
    </span>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md p-1.5 text-ink-2 hover:bg-sunken disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

const REF_ROWS = [
  ["euAiAct", "EU AI Act", "Regulation (EU) 2024/1689"],
  ["iso42001", "ISO/IEC 42001", "2023, Annex A"],
  ["nistAiRmf", "NIST AI RMF", "1.0 (AI 100-1)"],
  ["finma", "FINMA", "Guidance 08/2024, section"],
] as const;

/** Week 6: where this control comes from. Empty = no verified reference fits (never guessed). */
function FrameworkRefs({ refs }: { refs: { euAiAct: string; iso42001: string; nistAiRmf: string; finma: string } }) {
  return (
    <section data-testid="framework-refs">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.09em] text-ink-2">Framework mapping</h3>
      <dl className="mt-2 grid grid-cols-[130px_1fr] gap-x-4 gap-y-1.5 rounded-md border border-rule bg-surface px-4 py-3 text-[13.5px]">
        {REF_ROWS.map(([k, name, note]) => (
          <div key={k} className="contents">
            <dt className="text-muted">
              {name}
              <span className="block text-[11px]">{note}</span>
            </dt>
            <dd className={refs[k] ? "font-mono text-[13px] text-ink" : "text-[12.5px] italic text-muted"}>{refs[k] || "— no verified reference"}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1.5 text-[12px] text-muted">References checked on the web on 2026-11-15; a reference is left empty rather than guessed. Not legal advice.</p>
    </section>
  );
}
