/**
 * Week 4 — automation-opportunity heatmap and business case per control.
 * Fully deterministic: the automation score comes from the review (LLM, review.v1); everything here is
 * arithmetic on declared assumptions that the user can change. No LLM call, so it works in demo mode and rules-only.
 * Client-safe: no Node or network imports.
 */
import { normalizeFrequency } from "./rules";
import type { Control, Review, Span } from "./schema";
import { spanAt } from "./spans";
import { blockersFrom, samplingFrequency, type SampleFreq } from "./testscript";

/* ------------------------------------------------------------------ */
/* Assumptions                                                         */
/* ------------------------------------------------------------------ */

export type RunFreq = Exclude<SampleFreq, "continuous" | "unknown">;
export const RUN_FREQS: RunFreq[] = ["event", "daily", "weekly", "monthly", "quarterly", "semiannual", "annual"];

/** Frequencies with a calendar count. "event" has none: its volume must come from the user, per control. */
export type CalFreq = Exclude<RunFreq, "event">;
export const CAL_FREQS: CalFreq[] = ["daily", "weekly", "monthly", "quarterly", "semiannual", "annual"];

export const FREQ_LABELS: Record<RunFreq, string> = {
  event: "Per transaction / event",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semiannual: "Semi-annual",
  annual: "Annual",
};

export interface Assumptions {
  /** Controls with an automation score at or above this get a business case. */
  threshold: number;
  /** Occurrences per year by calendar frequency. Per-transaction controls have no default: the user enters the volume. */
  runsPerYear: Record<CalFreq, number>;
  /** Manual effort per occurrence, in minutes, by frequency (performer + reviewer + evidence filing). */
  minutesPerRun: Record<RunFreq, number>;
  /** Share of the manual effort that automation removes, by score (the rest is exception handling / judgment). */
  shareRemoved: Record<4 | 5, number>;
  /** Fully loaded internal cost per hour (CHF). */
  hourlyRate: number;
  /** Productive hours per FTE per year. */
  hoursPerFte: number;
  /** One-off build effort in hours, by approach. */
  buildHours: Record<Approach, number>;
}

/** Illustrative, generic defaults. Every number is shown and editable in the UI; none is firm methodology. */
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  threshold: 4,
  runsPerYear: { daily: 250, weekly: 52, monthly: 12, quarterly: 4, semiannual: 2, annual: 1 },
  minutesPerRun: { event: 10, daily: 30, weekly: 60, monthly: 180, quarterly: 240, semiannual: 300, annual: 480 },
  shareRemoved: { 4: 0.6, 5: 0.9 },
  hourlyRate: 110,
  hoursPerFte: 1700,
  buildHours: { itac: 40, rpa: 80 },
};

/**
 * Rebuild assumptions from untrusted stored JSON (e.g. localStorage): every field falls back to the default
 * unless it is a finite, non-negative number; shares are clamped to 0–1 and the threshold to 3–5.
 */
export function sanitizeAssumptions(raw: unknown): Assumptions {
  const d = DEFAULT_ASSUMPTIONS;
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown, fb: number, max = Infinity) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : fb);
  const rec = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
  const byFreq = <F extends RunFreq>(freqs: F[], v: unknown, fb: Record<F, number>) =>
    Object.fromEntries(freqs.map((f) => [f, n(rec(v)[f], fb[f])])) as Record<F, number>;
  const t = n(o.threshold, d.threshold);
  return {
    threshold: [3, 4, 5].includes(t) ? t : d.threshold,
    runsPerYear: byFreq(CAL_FREQS, o.runsPerYear, d.runsPerYear),
    minutesPerRun: byFreq(RUN_FREQS, o.minutesPerRun, d.minutesPerRun),
    shareRemoved: { 4: n(rec(o.shareRemoved)[4], d.shareRemoved[4], 1), 5: n(rec(o.shareRemoved)[5], d.shareRemoved[5], 1) },
    hourlyRate: n(o.hourlyRate, d.hourlyRate),
    hoursPerFte: n(o.hoursPerFte, d.hoursPerFte),
    buildHours: { itac: n(rec(o.buildHours).itac, d.buildHours.itac), rpa: n(rec(o.buildHours).rpa, d.buildHours.rpa) },
  };
}

/** Per-control overrides set in the UI (e.g. the real transaction volume of a per-invoice control). */
export type Overrides = Record<string, { runsPerYear?: number; minutesPerRun?: number }>;

/* ------------------------------------------------------------------ */
/* Approach                                                            */
/* ------------------------------------------------------------------ */

export type Approach = "itac" | "rpa";
export const APPROACH_LABELS: Record<Approach, string> = {
  itac: "ITAC (configure in the system)",
  rpa: "RPA / script",
};

/** Wording that points to a check the system itself can enforce at entry. */
const ITAC_CUES = /\b(three-way match|match(es|ing)?|block(s|ed)?|tolerance|duplicate|validat\w*|mandatory field|workflow|approv\w*|release[sd]?|authori[sz]\w*|limit|access|password|segregat\w*|lock(s|ed)?)\b/i;
/** Wording that points to a repeatable comparison over system data, done after the fact. */
const RPA_CUES = /\b(reconcil\w*|compares?|compared|agrees?|ties?|ageing|aging|report|listing|extract\w*|download\w*|exports?|analy[sz](?:e|es|ed|is|ing)|checks? whether|recalculat\w*|monitor\w*|review(s|ed)?)\b/i;
/** Systems that are document stores rather than systems of record: nothing to configure an ITAC in. */
const NOT_A_SYSTEM = /^(sharepoint|excel|e-?mail|outlook|paper|word|teams|file share)$/i;

/** Automated by nature, unless the review found manual steps behind an "Automated" label (nature_mismatch). */
export function isAlreadyAutomated(c: Control, review?: Review | null): boolean {
  if (review?.findings.some((f) => f.check === "nature_mismatch")) return false;
  return samplingFrequency(c) === "continuous";
}

export function recordSystems(c: Control): string[] {
  return c.systems
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => s && !NOT_A_SYSTEM.test(s));
}

/**
 * Pick ITAC or RPA/script and cite the words that drove the choice (verified span, offsets by code).
 * ITAC when the control is preventive, runs in a system of record and the text names an enforceable check;
 * otherwise a script/bot that performs the comparison and routes exceptions to the owner.
 */
export function chooseApproach(c: Control): { approach: Approach; why: string; span: Span | null } {
  const text = c.control_description;
  const itac = ITAC_CUES.exec(text);
  const rpa = RPA_CUES.exec(text);
  const preventive = /prevent|präventiv|praeventiv/i.test(c.control_type);
  const systems = recordSystems(c);
  if (preventive && systems.length && itac) {
    return {
      approach: "itac",
      why: `Preventive, runs in ${systems[0]}, and the check is one the system can enforce at entry.`,
      span: spanAt("control_description", text, itac.index, itac.index + itac[0].length),
    };
  }
  if (rpa) {
    return {
      approach: "rpa",
      why: `A repeatable comparison over ${systems[0] ?? "system"} data: a script performs it, a person reviews the exceptions.`,
      span: spanAt("control_description", text, rpa.index, rpa.index + rpa[0].length),
    };
  }
  if (itac) {
    return {
      approach: preventive && systems.length ? "itac" : "rpa",
      why: systems.length ? `The check is rule-based; no system of record to configure it in, so a script performs it.` : "The check is rule-based; a script performs it.",
      span: spanAt("control_description", text, itac.index, itac.index + itac[0].length),
    };
  }
  return {
    approach: preventive && systems.length ? "itac" : "rpa",
    why: "No cue word in the description; chosen from control type and systems only.",
    span: null,
  };
}

/* ------------------------------------------------------------------ */
/* Business case                                                       */
/* ------------------------------------------------------------------ */

export interface BusinessCase {
  control_id: string;
  process: string;
  control_type: string;
  score: number;
  status: "candidate" | "automated" | "below";
  approach: Approach | null;
  approach_why: string;
  approach_span: Span | null;
  frequency: RunFreq | "continuous" | "unknown";
  runs_per_year: number;
  minutes_per_run: number;
  share_removed: number;
  hours_today: number;
  hours_saved: number;
  chf_saved: number;
  build_hours: number;
  /** Months until the build effort is paid back by the hours saved; null if nothing is saved. */
  payback_months: number | null;
  prerequisites: string[];
  /** High-severity design findings: fix the design before automating it. */
  blockers: string[];
  overridden: boolean;
  /** Per-transaction candidate without a user-entered volume: excluded from hours, CHF, FTE and payback. */
  needs_volume: boolean;
  /** strong: pays back within 12 months · moderate: within 36 · weak: later or never. */
  verdict: "strong" | "moderate" | "weak" | null;
}

export const VERDICT_LABELS = { strong: "Strong case", moderate: "Moderate case", weak: "Weak case" } as const;

/** Frequency for the effort model: sampling frequency, plus "per X" wording the review rules do not map. */
export function runFrequency(c: Control, review?: Review | null): RunFreq | "continuous" | "unknown" {
  const f = samplingFrequency(c);
  if (f === "continuous" && !isAlreadyAutomated(c, review)) {
    // Labelled automated, but the review found manual steps: fall back to the frequency column.
    const col = normalizeFrequency(c.frequency);
    return col && col !== "continuous" ? col : "unknown";
  }
  if (f !== "unknown") return f;
  if (/^(per|each|every|upon|on|bei|pro|je)\b/i.test(c.frequency.trim())) return "event";
  return normalizeFrequency(c.frequency) ?? "unknown";
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function prerequisitesFor(c: Control, review: Review | null | undefined, approach: Approach): string[] {
  const sys = recordSystems(c)[0] ?? "the system of record";
  const owner = c.control_owner || "the control owner";
  const out =
    approach === "itac"
      ? [
          `Configuration in ${sys} specified, tested and baselined (screenshot or config report as evidence).`,
          `Effective ITGCs over ${sys}: change management and restricted access to the configuration.`,
          `Override / exception path with role-based release, logged in ${sys}.`,
          "Re-test as a test of one plus ITGC reliance replaces the manual sample.",
        ]
      : [
          `Complete and accurate input from ${sys} (IPE: report logic and parameters validated).`,
          "Script or bot under change control, running with its own technical user and least-privilege access.",
          `Exceptions routed to ${owner} for review and sign-off: the human review of exceptions remains the control.`,
          "Run log and exception list retained as evidence for each run.",
        ];
  const checks = new Set(review?.findings.map((f) => f.check) ?? []);
  if (checks.has("precision")) out.unshift("Define an explicit threshold first: a robot needs a number, not “significant”.");
  if (checks.has("sod_conflict")) out.unshift("Resolve the segregation-of-duties conflict before automating the approval.");
  if (checks.has("evidence") || checks.has("key_no_evidence")) out.push("Decide what the automated control retains as evidence (log, report, ticket).");
  if (checks.has("frequency") || runFrequency(c, review) === "unknown") out.unshift("State the frequency: without it the hours saved cannot be estimated.");
  return out;
}

export function businessCase(c: Control, review: Review | null | undefined, a: Assumptions = DEFAULT_ASSUMPTIONS, ov: Overrides = {}): BusinessCase {
  const score = review?.automation_score ?? 0;
  const freq = runFrequency(c, review);
  const automated = isAlreadyAutomated(c, review);
  const status = automated ? "automated" : score >= a.threshold ? "candidate" : "below";
  const { approach, why, span } = chooseApproach(c);
  const o = ov[c.control_id] ?? {};
  const known = freq !== "continuous" && freq !== "unknown";
  const needsVolume = status === "candidate" && freq === "event" && o.runsPerYear === undefined;
  const runs = o.runsPerYear ?? (known && freq !== "event" ? a.runsPerYear[freq] : 0);
  const minutes = o.minutesPerRun ?? (known ? a.minutesPerRun[freq] : 0);
  const share = automated ? 0 : a.shareRemoved[score >= 5 ? 5 : 4];
  const hoursToday = automated ? 0 : (runs * minutes) / 60;
  const saved = status === "candidate" ? hoursToday * share : 0;
  const build = status === "candidate" && !needsVolume ? a.buildHours[approach] : 0;
  return {
    control_id: c.control_id,
    process: c.process || "(no process)",
    control_type: c.control_type || "(not stated)",
    score,
    status,
    approach: status === "candidate" ? approach : automated ? "itac" : null,
    approach_why: automated ? "Already automated: the system performs the control; keep the ITGCs effective." : why,
    approach_span: automated ? null : span,
    frequency: freq,
    runs_per_year: runs,
    minutes_per_run: minutes,
    share_removed: status === "candidate" ? share : 0,
    hours_today: round1(hoursToday),
    hours_saved: round1(saved),
    chf_saved: Math.round(saved * a.hourlyRate),
    build_hours: build,
    payback_months: saved > 0 ? round1((build / saved) * 12) : null,
    prerequisites: status === "candidate" ? prerequisitesFor(c, review, approach) : [],
    blockers: status === "candidate" ? blockersFrom(review) : [],
    overridden: o.runsPerYear !== undefined || o.minutesPerRun !== undefined,
    needs_volume: needsVolume,
    verdict: status !== "candidate" || needsVolume ? null : saved <= 0 ? "weak" : (build / saved) * 12 <= 12 ? "strong" : (build / saved) * 12 <= 36 ? "moderate" : "weak",
  };
}

/* ------------------------------------------------------------------ */
/* Heatmap                                                             */
/* ------------------------------------------------------------------ */

export interface HeatCell {
  process: string;
  control_type: string;
  controls: number;
  avg_score: number;
  candidates: number;
  automated: number;
  hours_saved: number;
  /** Candidates waiting for a user-entered volume (not in hours_saved). */
  needs_volume: number;
}

export interface Heatmap {
  processes: string[];
  types: string[];
  cells: HeatCell[];
  cases: BusinessCase[];
  totals: { candidates: number; needs_volume: number; automated: number; hours_saved: number; chf_saved: number; fte: number; build_hours: number; blocked: number };
}

export function buildHeatmap(controls: Control[], reviews: Review[], a: Assumptions = DEFAULT_ASSUMPTIONS, ov: Overrides = {}): Heatmap {
  const byId = new Map(reviews.map((r) => [r.control_id, r]));
  const cases = controls.filter((c) => byId.has(c.control_id)).map((c) => businessCase(c, byId.get(c.control_id), a, ov));
  const processes = [...new Set(cases.map((x) => x.process))];
  const typeOrder = (t: string) => (/prevent/i.test(t) ? 0 : /detect/i.test(t) ? 1 : 2);
  const types = [...new Set(cases.map((x) => x.control_type))].sort((x, y) => typeOrder(x) - typeOrder(y) || x.localeCompare(y));
  const cells: HeatCell[] = [];
  for (const p of processes)
    for (const t of types) {
      const xs = cases.filter((x) => x.process === p && x.control_type === t);
      if (!xs.length) continue;
      cells.push({
        process: p,
        control_type: t,
        controls: xs.length,
        avg_score: round1(xs.reduce((n, x) => n + x.score, 0) / xs.length),
        candidates: xs.filter((x) => x.status === "candidate").length,
        automated: xs.filter((x) => x.status === "automated").length,
        hours_saved: round1(xs.reduce((n, x) => n + x.hours_saved, 0)),
        needs_volume: xs.filter((x) => x.needs_volume).length,
      });
    }
  const cand = cases.filter((x) => x.status === "candidate");
  const hours = cand.reduce((n, x) => n + x.hours_saved, 0);
  return {
    processes,
    types,
    cells,
    cases,
    totals: {
      candidates: cand.length,
      needs_volume: cand.filter((x) => x.needs_volume).length,
      automated: cases.filter((x) => x.status === "automated").length,
      hours_saved: Math.round(hours),
      chf_saved: Math.round(cand.reduce((n, x) => n + x.chf_saved, 0)),
      fte: a.hoursPerFte > 0 ? Math.round((hours / a.hoursPerFte) * 100) / 100 : 0,
      build_hours: cand.reduce((n, x) => n + x.build_hours, 0),
      blocked: cand.filter((x) => x.blockers.length).length,
    },
  };
}

/** Assumptions as label/value rows, for the export and the UI footnote. */
export function assumptionRows(a: Assumptions): [string, string | number][] {
  return [
    ["Business case threshold (automation score ≥)", a.threshold],
    ...CAL_FREQS.map((f) => [`Occurrences per year — ${FREQ_LABELS[f]}`, a.runsPerYear[f]] as [string, number]),
    ["Occurrences per year — Per transaction / event", "no default: entered per control; excluded from totals until entered"],
    ...RUN_FREQS.map((f) => [`Minutes per occurrence — ${FREQ_LABELS[f]}`, a.minutesPerRun[f]] as [string, number]),
    ["Share of effort removed — score 4", a.shareRemoved[4]],
    ["Share of effort removed — score 5", a.shareRemoved[5]],
    ["Hourly rate (CHF, fully loaded, illustrative)", a.hourlyRate],
    ["Productive hours per FTE per year", a.hoursPerFte],
    ["Build effort — ITAC (hours)", a.buildHours.itac],
    ["Build effort — RPA / script (hours)", a.buildHours.rpa],
  ];
}
