import { CHECK_IDS, CHECK_LABELS, type CheckId, type Review } from "./schema";

export type GroundTruth = Record<string, CheckId[]>;

export interface CheckMetrics {
  check: CheckId;
  expected: number;
  tp: number;
  fn: number;
  fp: number;
  recall: number | null;
}

export interface EvalReport {
  controls: number;
  cleanControls: number;
  plantedDefects: number;
  detected: number;
  recall: number;
  /** Share of clean (defect-free) controls that received at least one finding. */
  cleanFpRate: number;
  /** Findings on any control that are not in the ground truth, over all findings raised. */
  extraFindings: number;
  precision: number;
  perCheck: CheckMetrics[];
  misses: { control_id: string; check: CheckId }[];
  falsePositives: { control_id: string; check: CheckId; message: string }[];
}

export function evaluate(reviews: Review[], truth: GroundTruth): EvalReport {
  const per = new Map<CheckId, CheckMetrics>(CHECK_IDS.map((c) => [c, { check: c, expected: 0, tp: 0, fn: 0, fp: 0, recall: null }]));
  const misses: EvalReport["misses"] = [];
  const falsePositives: EvalReport["falsePositives"] = [];
  let cleanControls = 0;
  let cleanFlagged = 0;

  for (const [id, expectedList] of Object.entries(truth)) {
    const review = reviews.find((r) => r.control_id === id);
    const expected = new Set(expectedList);
    const got = new Set((review?.findings ?? []).map((f) => f.check));
    if (expected.size === 0) {
      cleanControls++;
      if (got.size > 0) cleanFlagged++;
    }
    for (const c of expected) {
      const m = per.get(c)!;
      m.expected++;
      if (got.has(c)) m.tp++;
      else {
        m.fn++;
        misses.push({ control_id: id, check: c });
      }
    }
    for (const c of got) {
      if (expected.has(c)) continue;
      per.get(c)!.fp++;
      falsePositives.push({ control_id: id, check: c, message: review!.findings.find((f) => f.check === c)!.message });
    }
  }
  for (const m of per.values()) m.recall = m.expected ? m.tp / m.expected : null;

  const planted = [...per.values()].reduce((n, m) => n + m.expected, 0);
  const detected = [...per.values()].reduce((n, m) => n + m.tp, 0);
  const fp = [...per.values()].reduce((n, m) => n + m.fp, 0);
  return {
    controls: Object.keys(truth).length,
    cleanControls,
    plantedDefects: planted,
    detected,
    recall: planted ? detected / planted : 1,
    cleanFpRate: cleanControls ? cleanFlagged / cleanControls : 0,
    extraFindings: fp,
    precision: detected + fp ? detected / (detected + fp) : 1,
    perCheck: [...per.values()],
    misses,
    falsePositives,
  };
}

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

export function evalMarkdown(r: EvalReport, meta: { model: string; promptVersion: string; source: string; date: string }): string {
  const lines = [
    "# Eval — latest",
    "",
    `_Generated ${meta.date} · model \`${meta.model}\` · prompt \`${meta.promptVersion}\` · source: ${meta.source}_`,
    "",
    `Evaluated on **${r.controls} synthetic controls** with **${r.plantedDefects} planted defects** (${r.controls - r.cleanControls} defective controls, ${r.cleanControls} clean).`,
    "",
    "| Metric | Value |",
    "|---|---|",
    `| Recall (planted defects found) | **${pct(r.recall)}** (${r.detected}/${r.plantedDefects}) |`,
    `| False-positive rate on clean controls | **${pct(r.cleanFpRate)}** (clean controls with ≥1 finding) |`,
    `| Precision (findings that match ground truth) | ${pct(r.precision)} (${r.extraFindings} extra findings) |`,
    "",
    "## Per check",
    "",
    "| Check | Planted | Found | Missed | Extra | Recall |",
    "|---|---:|---:|---:|---:|---:|",
    ...r.perCheck.map((m) => `| ${CHECK_LABELS[m.check]} (\`${m.check}\`) | ${m.expected} | ${m.tp} | ${m.fn} | ${m.fp} | ${pct(m.recall)} |`),
    "",
    "## Misses",
    "",
    ...(r.misses.length ? r.misses.map((m) => `- ${m.control_id}: \`${m.check}\``) : ["- none"]),
    "",
    "## Extra findings (not in ground truth)",
    "",
    ...(r.falsePositives.length ? r.falsePositives.map((f) => `- ${f.control_id}: \`${f.check}\` — ${f.message}`) : ["- none"]),
    "",
    "Ground truth: `data/demo-rcm.ground-truth.json`. Reproduce: `npm run eval` (set `OPENROUTER_API_KEY` for a live run).",
    "",
  ];
  return lines.join("\n");
}
