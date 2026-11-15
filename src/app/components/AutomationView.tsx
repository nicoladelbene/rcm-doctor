"use client";
import { useMemo, useState } from "react";
import {
  APPROACH_LABELS, buildHeatmap, DEFAULT_ASSUMPTIONS, FREQ_LABELS, RUN_FREQS, VERDICT_LABELS,
  type Assumptions, type BusinessCase, type Heatmap, type Overrides,
} from "@/core/automation";
import type { Control, Review } from "@/core/schema";
import { AutomationMeter } from "./bits";
import { Highlighted } from "./Highlighted";

const nf = new Intl.NumberFormat("de-CH");
const fmt = (n: number) => nf.format(n);

/** Week 4: process × control type heatmap of automation scores, and a business case per candidate. */
export function AutomationView({
  controls,
  reviews,
  assumptions: a,
  onAssumptions,
  overrides,
  onOverrides,
  onOpenControl,
}: {
  controls: Control[];
  reviews: Review[];
  assumptions: Assumptions;
  onAssumptions: (a: Assumptions) => void;
  overrides: Overrides;
  onOverrides: (o: Overrides) => void;
  onOpenControl: (id: string) => void;
}) {
  const [cell, setCell] = useState<{ process: string; type: string } | null>(null);
  const h = useMemo(() => buildHeatmap(controls, reviews, a, overrides), [controls, reviews, a, overrides]);
  const byId = useMemo(() => new Map(controls.map((c) => [c.control_id, c])), [controls]);
  const inCell = h.cases
    .filter((x) => x.status === "candidate")
    .filter((x) => !cell || (x.process === cell.process && x.control_type === cell.type))
    .sort((x, y) => y.hours_saved - x.hours_saved || x.control_id.localeCompare(y.control_id));
  const cases = inCell.filter((x) => !x.needs_volume);
  const pending = inCell.filter((x) => x.needs_volume);
  const setOverride = (id: string, o: Overrides[string] | null) => {
    const next = { ...overrides };
    if (o) next[id] = o;
    else delete next[id];
    onOverrides(next);
  };

  return (
    <div data-testid="automation">
      <p className="mb-4 flex items-center gap-2 rounded-md border border-weak/25 bg-weak-soft/50 px-3.5 py-2 text-[13px] text-ink-2" data-testid="illustrative-banner">
        <span className="font-semibold text-weak">Illustrative defaults</span> — edit assumptions to your context.
      </p>
      <Totals h={h} a={a} />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <HeatGrid h={h} threshold={a.threshold} cell={cell} onCell={setCell} />

          <div className="mt-8 mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-serif text-[20px] font-semibold text-ink">
              Business cases{cell ? ` · ${cell.process} / ${cell.type}` : ""}
              <span className="ml-2 font-sans text-[13px] font-normal text-muted tnum">{cases.length} priced, largest saving first</span>
            </h3>
            {cell && (
              <button type="button" className="text-[13px] text-accent underline underline-offset-2" onClick={() => setCell(null)}>
                Show all processes
              </button>
            )}
          </div>
          {pending.length > 0 && <PendingVolume pending={pending} overrides={overrides} onOverride={setOverride} onOpen={onOpenControl} />}
          {cases.length === 0 ? (
            <p className="rounded-lg border border-dashed border-rule-strong bg-surface p-8 text-center text-[14px] text-muted">
              {pending.length ? "No priced business case here yet: enter a volume above." : `No control in this cell has an automation score ≥ ${a.threshold}.`}
            </p>
          ) : (
            <div className="space-y-3">
              {cases.map((x) => (
                <CaseCard
                  key={x.control_id}
                  x={x}
                  control={byId.get(x.control_id)!}
                  override={overrides[x.control_id]}
                  onOverride={(o) => setOverride(x.control_id, o)}
                  onOpen={() => onOpenControl(x.control_id)}
                />
              ))}
            </div>
          )}
        </div>

        <AssumptionsPanel a={a} onChange={onAssumptions} overrides={Object.keys(overrides).length} onClearOverrides={() => onOverrides({})} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Totals({ h, a }: { h: Heatmap; a: Assumptions }) {
  const t = h.totals;
  const items: [string, string, string][] = [
    [
      `Candidates (score ≥ ${a.threshold})`,
      String(t.candidates),
      [t.needs_volume ? `${t.needs_volume} need a volume (not in totals)` : "", t.blocked ? `${t.blocked} need a design fix first` : ""].filter(Boolean).join(" · ") || "all priced, none blocked",
    ],
    ["Hours saved / year", fmt(t.hours_saved), `≈ ${t.fte.toLocaleString("de-CH")} FTE at ${fmt(a.hoursPerFte)} h`],
    ["CHF saved / year", fmt(t.chf_saved), `at CHF ${a.hourlyRate}/h, before build cost`],
    ["Build effort", `${fmt(t.build_hours)} h`, `one-off · ${t.hours_saved ? `pays back in ${Math.round((t.build_hours / t.hours_saved) * 12)} months overall` : "no saving"}`],
    ["Already automated", String(t.automated), "keep the ITGCs effective"],
  ];
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-lg border border-rule bg-surface px-5 py-5 sm:grid-cols-3 lg:grid-cols-5" data-testid="automation-totals">
      {items.map(([label, value, sub]) => (
        <div key={label} className="min-w-0">
          <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">{label}</div>
          <div className="mt-1 font-serif text-[30px] leading-none font-semibold text-ink tnum" data-testid={`total-${label.split(" ")[0].toLowerCase()}`}>
            {value}
          </div>
          <div className="mt-1.5 text-[12.5px] text-muted">{sub}</div>
        </div>
      ))}
    </div>
  );
}

function heat(score: number) {
  const pct = Math.round((score / 5) * 85) + 5;
  return { background: `color-mix(in srgb, var(--accent) ${pct}%, var(--surface))`, color: pct > 50 ? "var(--paper)" : "var(--ink)" };
}

function HeatGrid({
  h,
  threshold,
  cell,
  onCell,
}: {
  h: Heatmap;
  threshold: number;
  cell: { process: string; type: string } | null;
  onCell: (c: { process: string; type: string } | null) => void;
}) {
  const get = (p: string, t: string) => h.cells.find((c) => c.process === p && c.control_type === t);
  const rowHours = (p: string) => h.cells.filter((c) => c.process === p).reduce((n, c) => n + c.hours_saved, 0);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-[20px] font-semibold text-ink">Automation heatmap</h3>
        <span className="flex items-center gap-2 text-[12px] text-muted">
          Avg. automation score
          <span className="inline-flex overflow-hidden rounded-[3px]" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((s) => (
              <span key={s} className="h-3 w-5" style={heat(s)} />
            ))}
          </span>
          0 → 5
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
        <table className="w-full min-w-[560px] border-collapse text-left text-[13px]" data-testid="heatmap">
          <thead>
            <tr className="border-b border-rule-strong bg-sunken/60 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted">
              <th scope="col" className="px-4 py-2.5">Process \ Control type</th>
              {h.types.map((t) => (
                <th key={t} scope="col" className="px-2 py-2.5 text-center">
                  {t}
                </th>
              ))}
              <th scope="col" className="w-[110px] px-4 py-2.5 text-right">Hours saved / yr</th>
            </tr>
          </thead>
          <tbody>
            {h.processes.map((p) => (
              <tr key={p} className="border-b border-rule last:border-b-0">
                <th scope="row" className="px-4 py-2 text-[13.5px] font-medium text-ink">
                  {p}
                </th>
                {h.types.map((t) => {
                  const c = get(p, t);
                  if (!c) return <td key={t} className="px-2 py-2 text-center text-[12px] text-muted">—</td>;
                  const on = cell?.process === p && cell.type === t;
                  return (
                    <td key={t} className="px-1.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => onCell(on ? null : { process: p, type: t })}
                        aria-pressed={on}
                        data-testid="heat-cell"
                        data-cell={`${p}|${t}`}
                        title={`${p} / ${t}: ${c.controls} controls, average score ${c.avg_score}, ${c.candidates} with score ≥ ${threshold}`}
                        style={heat(c.avg_score)}
                        className={`flex w-full flex-col items-center rounded-md px-2 py-2.5 transition-shadow hover:ring-2 hover:ring-ink/40 ${on ? "ring-2 ring-ink" : ""}`}
                      >
                        <span className="font-serif text-[22px] leading-none font-semibold tnum">{c.avg_score.toFixed(1)}</span>
                        <span className="mt-1 text-[11.5px] opacity-90 tnum">
                          {c.controls} ctrl · {c.candidates} ≥ {threshold}
                          {c.automated ? ` · ${c.automated} auto` : ""}
                        </span>
                        <span className="text-[11.5px] font-medium opacity-90 tnum">
                          {fmt(Math.round(c.hours_saved))} h/yr{c.needs_volume ? ` · ${c.needs_volume} need volume` : ""}
                        </span>
                      </button>
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-right font-mono text-[13px] text-ink tnum">{fmt(Math.round(rowHours(p)))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12.5px] text-muted">Click a cell to see its business cases. Scores come from the AI review; hours come from the assumptions on the right.</p>
    </div>
  );
}

function PendingVolume({
  pending,
  overrides,
  onOverride,
  onOpen,
}: {
  pending: BusinessCase[];
  overrides: Overrides;
  onOverride: (id: string, o: Overrides[string] | null) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="mb-4 rounded-lg border border-dashed border-rule-strong bg-surface p-4" data-testid="pending-volume">
      <h4 className="text-[14px] font-semibold text-ink">
        {pending.length} per-transaction control{pending.length > 1 ? "s" : ""}: enter the annual volume to include {pending.length > 1 ? "them" : "it"}
      </h4>
      <p className="mt-0.5 text-[12.5px] text-muted">An RCM does not say how many invoices, payments or changes there are. Until you do, these stay out of hours, CHF, FTE and payback.</p>
      <ul className="mt-3 divide-y divide-rule">
        {pending.map((x) => (
          <li key={x.control_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px]" data-testid="pending-row" data-id={x.control_id}>
            <button type="button" onClick={() => onOpen(x.control_id)} className="font-mono text-[12.5px] font-medium text-accent underline decoration-accent/30 underline-offset-2">
              {x.control_id}
            </button>
            <span className="text-muted">
              {x.process} · {x.control_type}
            </span>
            <AutomationMeter score={x.score} />
            <span className="rounded-[4px] bg-accent-soft px-1.5 py-px text-[12px] text-accent-ink">{x.approach ? APPROACH_LABELS[x.approach] : ""}</span>
            <label className="ml-auto inline-flex items-center gap-1.5 text-ink-2">
              <input
                type="number"
                min={0}
                placeholder="volume"
                aria-label={`Annual volume for ${x.control_id}`}
                data-testid="volume-input"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const v = Number((e.target as HTMLInputElement).value);
                  if (v > 0) onOverride(x.control_id, { ...overrides[x.control_id], runsPerYear: v });
                }}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v > 0) onOverride(x.control_id, { ...overrides[x.control_id], runsPerYear: v });
                }}
                className="w-[90px] rounded-[5px] border border-rule-strong bg-surface px-1.5 py-0.5 text-right font-mono text-[13px]"
              />
              / yr × {x.minutes_per_run} min
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

const VERDICT_STYLE = {
  strong: "bg-pass-soft text-pass ring-pass/25",
  moderate: "bg-weak-soft text-weak ring-weak/25",
  weak: "bg-sunken text-muted ring-rule-strong",
} as const;

function CaseCard({
  x,
  control,
  override,
  onOverride,
  onOpen,
}: {
  x: BusinessCase;
  control: Control;
  override: Overrides[string] | undefined;
  onOverride: (o: Overrides[string] | null) => void;
  onOpen: () => void;
}) {
  const freqLabel = x.frequency in FREQ_LABELS ? FREQ_LABELS[x.frequency as keyof typeof FREQ_LABELS] : "Frequency unknown";
  const setOv = (k: "runsPerYear" | "minutesPerRun", v: string) => {
    const n = v === "" ? undefined : Math.max(0, Number(v));
    const next = { ...override, [k]: n };
    if (next.runsPerYear === undefined && next.minutesPerRun === undefined) onOverride(null);
    else onOverride(next);
  };
  return (
    <article className="rounded-lg border border-rule bg-surface p-4 sm:p-5" data-testid="case-card" data-id={x.control_id}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button type="button" onClick={onOpen} className="font-mono text-[13px] font-medium text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
          {x.control_id}
        </button>
        <span className="text-[12.5px] text-muted">
          {x.process} · {x.control_type} · {freqLabel}
        </span>
        <AutomationMeter score={x.score} />
        <span className="ml-auto flex items-center gap-2">
          <span className="rounded-[4px] border border-ink/20 bg-accent-soft px-1.5 py-px text-[12px] font-medium text-accent-ink" data-testid="approach">
            {x.approach ? APPROACH_LABELS[x.approach] : ""}
          </span>
          {x.verdict && (
            <span className={`rounded-full px-2 py-px text-[12px] font-medium ring-1 ring-inset ${VERDICT_STYLE[x.verdict]}`} data-testid="verdict">
              {VERDICT_LABELS[x.verdict]}
            </span>
          )}
        </span>
      </header>

      <p className="mt-3 font-serif text-[15px] leading-[1.7] text-ink">
        <Highlighted
          text={control.control_description}
          cites={x.approach_span ? [{ start: x.approach_span.start, end: x.approach_span.end, kind: "test", label: `Approach cue: ${x.approach_span.text}`, tag: x.approach === "itac" ? "ITAC" : "RPA" }] : []}
        />
      </p>
      <p className="mt-1.5 text-[13px] text-ink-2">
        <span className="font-medium text-ink">Why {x.approach === "itac" ? "ITAC" : "a script"}:</span> {x.approach_why}
      </p>

      {/* The arithmetic, in the open */}
      <div className="mt-3 grid gap-3 rounded-md bg-sunken/60 px-3.5 py-3 text-[13px] sm:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-ink-2 tnum" data-testid="case-math">
          <NumIn label="Occurrences per year" value={x.runs_per_year} overridden={override?.runsPerYear !== undefined} onChange={(v) => setOv("runsPerYear", v)} />
          <span>×</span>
          <NumIn label="Minutes per occurrence" value={x.minutes_per_run} overridden={override?.minutesPerRun !== undefined} onChange={(v) => setOv("minutesPerRun", v)} suffix="min" />
          <span>=</span>
          <span className="text-ink">{fmt(x.hours_today)} h today</span>
          <span>×</span>
          <span>{Math.round(x.share_removed * 100)}% removed</span>
          <span>=</span>
          <span className="font-semibold text-ink" data-testid="hours-saved">
            {fmt(x.hours_saved)} h/yr saved
          </span>
          {x.overridden && (
            <button type="button" onClick={() => onOverride(null)} className="ml-1 text-[12px] text-accent underline underline-offset-2">
              reset
            </button>
          )}
        </div>
        <div className="flex gap-4 text-[12.5px] text-muted sm:justify-end">
          <span>
            <span className="font-semibold text-ink tnum">CHF {fmt(x.chf_saved)}</span> / yr
          </span>
          <span>
            build <span className="font-semibold text-ink tnum">{x.build_hours} h</span>
          </span>
          <span>
            payback <span className="font-semibold text-ink tnum">{x.payback_months === null ? "n/a" : `${x.payback_months} mo`}</span>
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">Prerequisites</div>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[13px] text-ink-2">
            {x.prerequisites.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        </div>
        {x.blockers.length > 0 && (
          <div className="rounded-md border border-fail/30 bg-fail-soft/60 px-3 py-2 sm:max-w-[260px]" data-testid="case-blocked">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-fail">Remediate the design first</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12.5px] text-ink-2">
              {x.blockers.map((b, i) => (
                <li key={i}>{b.replace(/^(\w+): /, "")}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}

function NumIn({ label, value, onChange, overridden, suffix }: { label: string; value: number; onChange: (v: string) => void; overridden: boolean; suffix?: string }) {
  return (
    <label className="inline-flex items-center gap-1">
      <span className="sr-only">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={`${label}${overridden ? " (overridden for this control)" : " (from the assumptions; edit to override for this control)"}`}
        className={`w-[72px] rounded-[5px] border bg-surface px-1.5 py-0.5 text-right font-mono text-[13px] ${overridden ? "border-accent text-accent-ink" : "border-rule-strong text-ink"}`}
      />
      {suffix && <span>{suffix}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ */

function AssumptionsPanel({ a, onChange, overrides, onClearOverrides }: { a: Assumptions; onChange: (a: Assumptions) => void; overrides: number; onClearOverrides: () => void }) {
  const changed = JSON.stringify(a) !== JSON.stringify(DEFAULT_ASSUMPTIONS);
  const num = (v: string) => Math.max(0, Number(v) || 0);
  return (
    <aside className="rounded-lg border border-rule bg-surface p-4 lg:sticky lg:top-4" data-testid="assumptions" aria-label="Assumptions">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-[18px] font-semibold text-ink">Assumptions</h3>
        {changed && (
          <button type="button" className="text-[12.5px] text-accent underline underline-offset-2" onClick={() => onChange(DEFAULT_ASSUMPTIONS)} data-testid="reset-assumptions">
            Reset defaults
          </button>
        )}
      </div>
      <p className="mt-1 text-[12.5px] leading-snug text-muted">Illustrative, generic defaults. Change any number: the heatmap and every business case recalculate. Your changes are kept in this browser.</p>

      <div className="mt-3 space-y-2.5 text-[13px]">
        <Row label="Business case for score ≥">
          <select
            value={a.threshold}
            onChange={(e) => onChange({ ...a, threshold: Number(e.target.value) })}
            className="rounded-[5px] border border-rule-strong bg-surface px-1.5 py-0.5 font-mono"
            data-testid="assume-threshold"
          >
            {[3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Effort removed, score 4">
          <Pct value={a.shareRemoved[4]} onChange={(v) => onChange({ ...a, shareRemoved: { ...a.shareRemoved, 4: v } })} />
        </Row>
        <Row label="Effort removed, score 5">
          <Pct value={a.shareRemoved[5]} onChange={(v) => onChange({ ...a, shareRemoved: { ...a.shareRemoved, 5: v } })} />
        </Row>
        <Row label={<>Hourly rate, CHF <span className="text-muted">(fully loaded, illustrative)</span></>}>
          <Num value={a.hourlyRate} onChange={(v) => onChange({ ...a, hourlyRate: num(v) })} testId="assume-rate" />
        </Row>
        <Row label="Productive hours per FTE">
          <Num value={a.hoursPerFte} onChange={(v) => onChange({ ...a, hoursPerFte: num(v) })} />
        </Row>
        <Row label="Build effort ITAC, hours">
          <Num value={a.buildHours.itac} onChange={(v) => onChange({ ...a, buildHours: { ...a.buildHours, itac: num(v) } })} />
        </Row>
        <Row label="Build effort RPA / script, hours">
          <Num value={a.buildHours.rpa} onChange={(v) => onChange({ ...a, buildHours: { ...a.buildHours, rpa: num(v) } })} />
        </Row>
      </div>

      <table className="mt-4 w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-rule text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
            <th className="py-1 text-left font-semibold">Frequency</th>
            <th className="py-1 text-right font-semibold">Runs / yr</th>
            <th className="py-1 text-right font-semibold">Min / run</th>
          </tr>
        </thead>
        <tbody>
          {RUN_FREQS.map((f) => (
            <tr key={f} className="border-b border-rule last:border-b-0">
              <td className="py-1 pr-2 text-ink-2">{FREQ_LABELS[f]}</td>
              <td className="py-1 text-right">
                {f === "event" ? (
                  <span className="text-[12px] text-muted">per control</span>
                ) : (
                  <Num value={a.runsPerYear[f]} onChange={(v) => onChange({ ...a, runsPerYear: { ...a.runsPerYear, [f]: num(v) } })} testId={`assume-runs-${f}`} />
                )}
              </td>
              <td className="py-1 pl-1 text-right">
                <Num value={a.minutesPerRun[f]} onChange={(v) => onChange({ ...a, minutesPerRun: { ...a.minutesPerRun, [f]: num(v) } })} testId={`assume-min-${f}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] leading-snug text-muted">
        Per-transaction controls have no default volume: enter it per control to include them in the totals.
        {overrides > 0 && (
          <>
            {" "}
            {overrides} control{overrides > 1 ? "s" : ""} overridden.{" "}
            <button type="button" className="text-accent underline underline-offset-2" onClick={onClearOverrides}>
              Clear
            </button>
          </>
        )}
      </p>
      <p className="mt-2 text-[12px] leading-snug text-muted">Exported with the report (sheet “Automation”), so every number can be traced back to an assumption.</p>
    </aside>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-ink-2">{label}</span>
      {children}
    </label>
  );
}

function Num({ value, onChange, testId }: { value: number; onChange: (v: string) => void; testId?: string }) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
      className="w-[78px] rounded-[5px] border border-rule-strong bg-surface px-1.5 py-0.5 text-right font-mono text-[13px] text-ink"
    />
  );
}

function Pct({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100)}
        className="w-[64px] rounded-[5px] border border-rule-strong bg-surface px-1.5 py-0.5 text-right font-mono text-[13px] text-ink"
      />
      <span className="text-muted">%</span>
    </span>
  );
}
