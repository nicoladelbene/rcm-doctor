"use client";
import { useEffect, useState } from "react";
import { CHECK_LABELS, type CheckId } from "@/core/schema";
import type { Summary } from "@/core/summary";

function useCountUp(target: number, ms = 900, decimals = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = reduced ? 1 : Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Number((target * eased).toFixed(decimals)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, decimals]);
  return v;
}

function Stat({ label, value, suffix, sub }: { label: string; value: number; suffix?: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className="mt-1 font-serif text-[34px] leading-none font-semibold text-ink tnum">
        {value}
        {suffix && <span className="ml-0.5 text-[18px] font-medium text-muted">{suffix}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[13px] text-muted">{sub}</div>}
    </div>
  );
}

export function SummaryBar({
  summary,
  onPickCheck,
  activeCheck,
}: {
  summary: Summary;
  onPickCheck: (c: CheckId | null) => void;
  activeCheck: CheckId | null;
}) {
  const total = useCountUp(summary.total);
  const findings = useCountUp(summary.findings);
  const auto = useCountUp(summary.avgAutomation, 900, 1);
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(t);
  }, []);
  const pct = (n: number) => (summary.total ? Math.round((n / summary.total) * 100) : 0);
  const parts = [
    { key: "fail", n: summary.fail, cls: "bg-fail", label: "Fail" },
    { key: "weak", n: summary.weak, cls: "bg-weak", label: "Weak" },
    { key: "pass", n: summary.pass, cls: "bg-pass", label: "Pass" },
  ];

  return (
    <section aria-label="Review summary" className="rounded-lg border border-rule bg-surface">
      <div className="grid grid-cols-2 gap-x-6 gap-y-6 p-5 sm:p-6 lg:grid-cols-[1fr_1fr_2.2fr_1fr]">
        <Stat label="Controls reviewed" value={total} />
        <Stat label="Findings" value={findings} sub="each cites its source text" />
        <div className="col-span-2 min-w-0 lg:col-span-1">
          <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Design assessment</div>
          <div className="mt-3 flex h-3 w-full overflow-hidden rounded-[3px] bg-sunken" role="img" aria-label={parts.map((p) => `${p.label} ${pct(p.n)}%`).join(", ")}>
            {parts.map((p) => (
              <div
                key={p.key}
                className={`${p.cls} h-full transition-[width] duration-[900ms] ease-out first:rounded-l-[3px] last:rounded-r-[3px] [&+&]:ml-px`}
                style={{ width: grown ? `${(p.n / Math.max(1, summary.total)) * 100}%` : "0%" }}
              />
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
            {parts.map((p) => (
              <span key={p.key} className="inline-flex items-center gap-1.5 tnum">
                <span className={`h-2 w-2 rounded-[2px] ${p.cls}`} />
                <span className="font-medium text-ink">{pct(p.n)}%</span> {p.label.toLowerCase()} <span className="text-muted">({p.n})</span>
              </span>
            ))}
          </div>
        </div>
        <Stat label="Avg. automation" value={auto} suffix="/5" sub="0 judgment · 5 ITAC" />
      </div>
      {summary.topChecks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-rule px-5 py-3 sm:px-6">
          <span className="mr-1 text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Top issues</span>
          {summary.topChecks.map((t, i) => {
            const on = activeCheck === t.check;
            return (
              <button
                key={t.check}
                type="button"
                onClick={() => onPickCheck(on ? null : t.check)}
                aria-pressed={on}
                className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[13px] transition-colors ${
                  on ? "border-ink bg-ink text-paper" : "border-rule-strong bg-paper text-ink hover:border-ink-2"
                }`}
              >
                <span className={`font-mono text-[11px] ${on ? "text-paper/70" : "text-muted"}`}>{i + 1}</span>
                {CHECK_LABELS[t.check]}
                <span className={`tnum font-mono text-[12px] ${on ? "text-paper/80" : "text-muted"}`}>×{t.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
