import type { CheckId, Review } from "./schema";

export interface Summary {
  total: number;
  pass: number;
  weak: number;
  fail: number;
  findings: number;
  avgAutomation: number;
  topChecks: { check: CheckId; count: number }[];
}

export function summarize(reviews: Review[]): Summary {
  const counts = new Map<CheckId, number>();
  for (const r of reviews) for (const f of r.findings) counts.set(f.check, (counts.get(f.check) ?? 0) + 1);
  const total = reviews.length;
  return {
    total,
    pass: reviews.filter((r) => r.status === "pass").length,
    weak: reviews.filter((r) => r.status === "weak").length,
    fail: reviews.filter((r) => r.status === "fail").length,
    findings: reviews.reduce((n, r) => n + r.findings.length, 0),
    avgAutomation: total ? Math.round((reviews.reduce((n, r) => n + r.automation_score, 0) / total) * 10) / 10 : 0,
    topChecks: [...counts.entries()]
      .map(([check, count]) => ({ check, count }))
      .sort((a, b) => b.count - a.count || a.check.localeCompare(b.check))
      .slice(0, 3),
  };
}
