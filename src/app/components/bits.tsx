import type { Severity, Status } from "@/core/schema";

const STATUS_STYLE: Record<Status, string> = {
  pass: "bg-pass-soft text-pass ring-pass/25",
  weak: "bg-weak-soft text-weak ring-weak/25",
  fail: "bg-fail-soft text-fail ring-fail/25",
};
const STATUS_LABEL: Record<Status, string> = { pass: "Pass", weak: "Weak", fail: "Fail" };

export function StatusPill({ status, size = "sm" }: { status: Status; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${STATUS_STYLE[status]} ${
        size === "md" ? "px-2.5 py-0.5 text-[13px]" : "px-2 py-px text-[12px]"
      }`}
    >
      <StatusGlyph status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Auditor tickmarks: ✓ pass, ~ weak, × fail. Shape carries meaning without colour. */
export function StatusGlyph({ status, className = "" }: { status: Status; className?: string }) {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden className={className}>
      {status === "pass" && <path d="M2.2 6.4 4.8 9 9.8 3.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
      {status === "weak" && <path d="M2 6.5c1.3-1.6 2.6-1.6 4 0s2.7 1.6 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
      {status === "fail" && <path d="M3 3l6 6M9 3 3 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

export const SEV_DOT: Record<Severity, string> = { high: "bg-fail", med: "bg-weak", low: "bg-rule-strong" };
export const SEV_LABEL: Record<Severity, string> = { high: "High", med: "Medium", low: "Low" };

export function SeverityTag({ severity }: { severity: Severity }) {
  const cls = severity === "high" ? "text-fail" : severity === "med" ? "text-weak" : "text-muted";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[severity]}`} />
      {SEV_LABEL[severity]}
    </span>
  );
}

export function AutomationMeter({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
  const w = size === "md" ? "h-2 w-5" : "h-1.5 w-2.5";
  return (
    <span className="inline-flex items-center gap-1.5" title={`Automation potential ${score} / 5`}>
      <span className="inline-flex gap-[3px]" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`${w} rounded-[2px] ${i <= score ? "bg-accent" : "bg-rule"}`} />
        ))}
      </span>
      <span className={`tnum font-mono ${size === "md" ? "text-sm" : "text-[12px]"} text-ink-2`}>{score}</span>
      <span className="sr-only">out of 5</span>
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-rule-strong bg-surface px-1 font-mono text-[11px] text-ink-2">{children}</kbd>;
}
