"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHECK_LABELS, CHECK_IDS, type CheckId, type Control, type Review, type ReviewRun, type Severity, type Status } from "@/core/schema";
import { summarize } from "@/core/summary";
import type { TestScript, TestScriptRun } from "@/core/testscript";
import { downloadReport, runReview, runTestScripts } from "../lib/client";
import { Drawer, type DrawerTab } from "./Drawer";
import { Highlighted } from "./Highlighted";
import { ResultsTable } from "./ResultsTable";
import { SummaryBar } from "./SummaryBar";
import { UploadPanel, type RunRequest } from "./UploadPanel";

export interface EvalHeadline {
  controls: number;
  plantedDefects: number;
  recall: number;
  cleanFpRate: number;
  model: string;
}

interface Dataset {
  controls: Control[];
  reviews: Review[];
  label: string;
  model: string;
  note?: string;
  demo: boolean;
  /** Week 2 test scripts, when generated. */
  scripts?: TestScript[];
  /** Week 6: framework references per control (AI systems controls pack). */
  mappings?: Record<string, FrameworkRefs>;
}

export interface FrameworkRefs {
  euAiAct: string;
  iso42001: string;
  nistAiRmf: string;
  finma: string;
}

const DEMO_SETS = {
  demo: { label: "Demo RCM · Alpenfirn Industries AG (fictional)" },
  ai: { label: "AI systems controls pack · Alpenfirn Industries AG (fictional)" },
} as const;
export type DemoSet = keyof typeof DEMO_SETS;

const GITHUB = "https://github.com/nicoladelbene/rcm-doctor";

export function App({ evalHeadline, holdout }: { evalHeadline: EvalHeadline | null; holdout?: EvalHeadline | null }) {
  const [data, setData] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState<null | { done: number; total: number; label: string }>(null);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sort, setSort] = useState<"worst" | "rcm">("worst");
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<DrawerTab>("review");
  // Held in memory for this tab only, so test scripts can be drafted after the review. Never persisted.
  const keyRef = useRef<{ apiKey?: string; model: string } | null>(null);
  const [canDraft, setCanDraft] = useState(false);
  const [f, setF] = useState<{ process: string; status: Status | "all"; severity: Severity | "all"; check: CheckId | null; keyOnly: boolean; q: string }>({
    process: "all",
    status: "all",
    severity: "all",
    check: null,
    keyOnly: false,
    q: "",
  });
  const resultsRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToResults = () => setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

  const loadDemo = useCallback(async (set: DemoSet = "demo") => {
    setError(null);
    setLoading({ done: 0, total: 0, label: set === "ai" ? "Loading the AI systems controls pack" : "Loading the demo RCM" });
    try {
      const res = await fetch(`/demo-data?set=${set}`);
      if (!res.ok) throw new Error(`Demo data unavailable (${res.status})`);
      const { controls, run, testscripts, mappings } = (await res.json()) as {
        controls: Control[];
        run: ReviewRun & { duration_seconds?: number };
        testscripts: TestScriptRun | null;
        mappings: Record<string, FrameworkRefs> | null;
      };
      const rulesOnly = run.reviews.filter((r) => r.llm_error).length;
      keyRef.current = null;
      setCanDraft(false);
      setF((x) => ({ ...x, process: "all", status: "all", severity: "all", check: null, keyOnly: false, q: "" }));
      setData({
        controls,
        reviews: run.reviews,
        scripts: testscripts?.scripts,
        mappings: mappings ?? undefined,
        label: DEMO_SETS[set].label,
        model: run.model,
        note:
          `Precomputed with ${run.model} on ${run.generated_at.slice(0, 10)}` +
          (rulesOnly ? ` · ${rulesOnly} of ${run.reviews.length} controls reviewed by the rules only (AI step unavailable)` : run.duration_seconds ? ` · live run took ${Math.round(run.duration_seconds)} s` : "") +
          (set === "ai" ? " · each control is mapped to verified EU AI Act, ISO/IEC 42001, NIST AI RMF and FINMA references" : ""),
        demo: true,
      });
      setOpenId(null);
      scrollToResults();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }, []);

  // Deep link: /?demo opens the demo directly (used by the README and the recording).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.has("demo")) return;
    const t = setTimeout(() => loadDemo(q.get("demo") === "ai" ? "ai" : "demo"), 0);
    return () => clearTimeout(t);
  }, [loadDemo]);

  async function startRun(r: RunRequest) {
    setUpload(false);
    setError(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const label = r.apiKey ? `Reviewing with ${r.model}` : "Running consistency rules";
    setLoading({ done: 0, total: r.controls.length, label });
    try {
      const reviews = await runReview(r.controls, {
        apiKey: r.apiKey,
        model: r.model,
        signal: ac.signal,
        onProgress: (done, total) => setLoading({ done: done.length, total, label }),
      });
      const failed = reviews.filter((x) => x.llm_error);
      keyRef.current = { apiKey: r.apiKey, model: r.model };
      setCanDraft(!!r.apiKey);
      // Without a key, the deterministic part of the test scripts (sample size, blockers) is free and instant.
      const scripts = r.apiKey ? undefined : await runTestScripts(r.controls, reviews, { model: "rules-only" });
      setF((x) => ({ ...x, process: "all", status: "all", severity: "all", check: null, keyOnly: false, q: "" }));
      setData({
        controls: r.controls,
        reviews,
        label: r.fileName,
        model: r.apiKey ? r.model : "rules-only",
        note: r.apiKey
          ? failed.length
            ? `AI step failed for ${failed.length} of ${reviews.length} controls (${failed[0].llm_error}). Rules still ran.`
            : `Reviewed live with ${r.model}`
          : "Rules-only review (no API key): the six deterministic consistency checks. Add a key for the design attributes, automation score and rewrite.",
        demo: false,
        scripts,
      });
      setOpenId(null);
      scrollToResults();
    } catch (e) {
      if (!ac.signal.aborted) setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function draftScripts() {
    if (!data || !keyRef.current?.apiKey) return;
    const { apiKey, model } = keyRef.current;
    const label = `Drafting test scripts with ${model}`;
    setLoading({ done: 0, total: data.controls.length, label });
    setError(null);
    try {
      const scripts = await runTestScripts(data.controls, data.reviews, { apiKey, model, onProgress: (done, total) => setLoading({ done, total, label }) });
      setData((d) => (d ? { ...d, scripts } : d));
      const failed = scripts.filter((t) => t.llm_error).length;
      setToast(failed ? `Test scripts drafted; AI step failed for ${failed} controls` : "Test scripts drafted · open a control and choose “Test script”");
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  const byId = useMemo(() => new Map(data?.reviews.map((r) => [r.control_id, r]) ?? []), [data]);
  const allRows = useMemo(
    () => (data ? data.controls.map((c) => ({ control: c, review: byId.get(c.control_id)! })).filter((r) => r.review) : []),
    [data, byId],
  );
  const processes = useMemo(() => [...new Set(allRows.map((r) => r.control.process).filter(Boolean))], [allRows]);
  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const filtered = allRows.filter(({ control: c, review: r }) => {
      if (f.process !== "all" && c.process !== f.process) return false;
      if (f.status !== "all" && r.status !== f.status) return false;
      if (f.severity !== "all" && !r.findings.some((x) => x.severity === f.severity)) return false;
      if (f.check && !r.findings.some((x) => x.check === f.check)) return false;
      if (f.keyOnly && !c.key_control) return false;
      if (q && !`${c.control_id} ${c.control_description} ${c.control_owner}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === "rcm") return filtered;
    // Worst first: status, then high-severity findings, then total findings; ties keep RCM order.
    const rank = { fail: 0, weak: 1, pass: 2 } as const;
    const highs = (r: Review) => r.findings.filter((x) => x.severity === "high").length;
    return filtered
      .map((row, i) => ({ row, i }))
      .sort(
        (a, b) =>
          rank[a.row.review.status] - rank[b.row.review.status] ||
          highs(b.row.review) - highs(a.row.review) ||
          b.row.review.findings.length - a.row.review.findings.length ||
          a.i - b.i,
      )
      .map((x) => x.row);
  }, [allRows, f, sort]);
  const summary = useMemo(() => summarize(allRows.map((r) => r.review)), [allRows]);
  const openIdx = rows.findIndex((r) => r.control.control_id === openId);
  const open = openIdx >= 0 ? rows[openIdx] : allRows.find((r) => r.control.control_id === openId);
  const filtersOn = f.process !== "all" || f.status !== "all" || f.severity !== "all" || f.check || f.keyOnly || f.q;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <Hero
          onDemo={loadDemo}
          onUpload={() => setUpload(true)}
          evalHeadline={evalHeadline}
          holdout={holdout ?? null}
          busy={!!loading}
        />

        {loading && <Progress {...loading} />}
        {error && (
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
            <p className="rounded-md border border-fail/30 bg-fail-soft px-4 py-3 text-[14px] text-fail">{error}</p>
          </div>
        )}

        {data && (
          <div ref={resultsRef} className="mx-auto max-w-[1240px] scroll-mt-4 px-4 pt-2 pb-16 sm:px-6" data-testid="results">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-[24px] font-semibold text-ink">{data.label}</h2>
                {data.note && <p className="mt-0.5 text-[13px] text-muted">{data.note}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-3">
              {data.scripts ? (
                <span className="text-[13px] text-ink-2" data-testid="testscript-summary">
                  <span className="font-medium text-ink">Test scripts:</span> {data.scripts.filter((t) => t.toe_ready).length} ready ·{" "}
                  {data.scripts.filter((t) => !t.toe_ready).length} blocked by design
                </span>
              ) : (
                canDraft && (
                  <button
                    type="button"
                    disabled={!!loading}
                    onClick={draftScripts}
                    data-testid="draft-testscripts"
                    className="rounded-md bg-ink px-3.5 py-2 text-[14px] font-medium text-paper hover:bg-ink-2 disabled:opacity-50"
                  >
                    Draft test scripts
                  </button>
                )
              )}
              <button
                type="button"
                onClick={async () => {
                  const name = await downloadReport(data.controls, data.reviews, data.label, data.scripts);
                  setToast(`${name} downloaded · findings, scores, rewrites${data.scripts ? " and test scripts" : ""}`);
                  setTimeout(() => setToast(null), 3500);
                }}
                data-testid="download-report"
                className="inline-flex items-center gap-2 rounded-md border border-ink bg-surface px-3.5 py-2 text-[14px] font-medium text-ink hover:bg-sunken"
              >
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />
                </svg>
                Download report (.xlsx)
              </button>
              </div>
            </div>

            <SummaryBar summary={summary} activeCheck={f.check} onPickCheck={(check) => setF((x) => ({ ...x, check }))} />

            {/* Toolbar */}
            <div className="mt-6 mb-3 flex flex-wrap items-center gap-2.5" role="toolbar" aria-label="Filters">
              <Segmented
                value={f.status}
                onChange={(status) => setF((x) => ({ ...x, status }))}
                options={[
                  ["all", `All ${summary.total}`],
                  ["fail", `Fail ${summary.fail}`],
                  ["weak", `Weak ${summary.weak}`],
                  ["pass", `Pass ${summary.pass}`],
                ]}
              />
              <Select label="Process" value={f.process} onChange={(process) => setF((x) => ({ ...x, process }))} options={[["all", "All processes"], ...processes.map((p) => [p, p] as [string, string])]} />
              <Select
                label="Severity"
                value={f.severity}
                onChange={(severity) => setF((x) => ({ ...x, severity: severity as Severity | "all" }))}
                options={[["all", "Any severity"], ["high", "High"], ["med", "Medium"], ["low", "Low"]]}
              />
              <Select
                label="Check"
                value={f.check ?? "all"}
                onChange={(v) => setF((x) => ({ ...x, check: v === "all" ? null : (v as CheckId) }))}
                options={[["all", "Any check"], ...CHECK_IDS.map((c) => [c, CHECK_LABELS[c]] as [string, string])]}
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-rule-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink-2">
                <input type="checkbox" checked={f.keyOnly} onChange={(e) => setF((x) => ({ ...x, keyOnly: e.target.checked }))} className="accent-[var(--accent)]" />
                Key controls only
              </label>
              <Select label="Sort" value={sort} onChange={(v) => setSort(v as "worst" | "rcm")} options={[["worst", "Worst first"], ["rcm", "RCM order"]]} neutral="worst" />
              <input
                type="search"
                value={f.q}
                onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))}
                placeholder="Search ID, text, owner"
                aria-label="Search controls"
                className="min-w-[180px] flex-1 rounded-md border border-rule-strong bg-surface px-3 py-1.5 text-[13px] sm:max-w-[260px]"
              />
              <span className="ml-auto text-[13px] text-muted tnum">
                {rows.length} of {allRows.length}
                {filtersOn && (
                  <button
                    type="button"
                    className="ml-2 text-accent underline underline-offset-2"
                    onClick={() => setF({ process: "all", status: "all", severity: "all", check: null, keyOnly: false, q: "" })}
                  >
                    Clear
                  </button>
                )}
              </span>
            </div>

            <ResultsTable rows={rows} onOpen={setOpenId} selectedId={openId} />
            <p className="mt-3 text-[12.5px] text-muted">Click a row to see cited spans, findings and the suggested rewrite. Use ↑ ↓ in the drawer to move between controls.</p>
          </div>
        )}

        {!data && !loading && <HowItWorks />}
      </main>

      <Footer />

      {open && (
        <Drawer
          control={open.control}
          review={open.review}
          position={openIdx >= 0 ? `${openIdx + 1} / ${rows.length}` : ""}
          script={data?.scripts?.find((t) => t.control_id === open.control.control_id)}
          refs={data?.mappings?.[open.control.control_id]}
          tab={tab}
          onTab={setTab}
          onClose={() => setOpenId(null)}
          onPrev={openIdx > 0 ? () => setOpenId(rows[openIdx - 1].control.control_id) : undefined}
          onNext={openIdx >= 0 && openIdx < rows.length - 1 ? () => setOpenId(rows[openIdx + 1].control.control_id) : undefined}
        />
      )}
      {upload && <UploadPanel onClose={() => setUpload(false)} onRun={startRun} />}
      {toast && (
        <div role="status" className="anim-rise fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-[13.5px] text-paper shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Header() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-mono text-[15px] font-medium tracking-tight text-ink">rcm-doctor</span>
          <span className="hidden rounded-[4px] border border-rule-strong px-1.5 py-px font-mono text-[11px] text-muted sm:inline">week 1</span>
        </Link>
        <nav className="flex items-center gap-5 text-[13.5px] text-ink-2">
          <a href={`${GITHUB}/blob/main/docs/eval-latest.md`} className="hidden hover:text-ink sm:inline">
            Eval
          </a>
          <a href={`${GITHUB}/blob/main/docs/ROADMAP.md`} className="hidden hover:text-ink sm:inline">
            Roadmap
          </a>
          <a href={GITHUB} className="inline-flex items-center gap-1.5 hover:text-ink">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}

function Logo() {
  // A tickmark inside a ledger cell.
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="3" fill="none" stroke="var(--ink)" strokeWidth="1.6" />
      <path d="M2.5 9h19M9 9v12.5" stroke="var(--rule-strong)" strokeWidth="1.2" />
      <path d="M11.5 15.2l2.3 2.3 4.4-5" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SPECIMEN = "The Treasury Manager prepares and approves manual (urgent) payments above CHF 1,000 outside the payment run in the e-banking portal.";

function Hero({
  onDemo,
  onUpload,
  evalHeadline,
  holdout,
  busy,
}: {
  onDemo: (set?: DemoSet) => void;
  onUpload: () => void;
  evalHeadline: EvalHeadline | null;
  holdout: EvalHeadline | null;
  busy: boolean;
}) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <section className="mx-auto grid max-w-[1240px] gap-10 px-4 pt-12 pb-10 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-16 lg:pb-14">
      <div>
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-accent">Internal controls · IKS · SOX</p>
        <h1 className="mt-3 max-w-[16ch] font-serif text-[40px] leading-[1.08] font-semibold tracking-[-0.01em] text-ink sm:text-[50px]">
          Review every control like a senior controls reviewer would.
        </h1>
        <p className="mt-5 max-w-[56ch] text-[17px] leading-[1.6] text-ink-2">
          Upload a Risk &amp; Control Matrix. rcm-doctor checks each control for <em>who, what, when, frequency, evidence</em> and{" "}
          <em>precision</em>, runs six consistency rules, scores automation potential and proposes a rewrite.{" "}
          <span className="text-ink">Every finding cites the exact text behind it.</span>
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onDemo("demo")}
            disabled={busy}
            data-testid="try-demo"
            className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-[15.5px] font-medium text-paper shadow-[0_1px_0_rgba(0,0,0,0.2)] transition-colors hover:bg-ink-2 disabled:opacity-60"
          >
            Try the demo RCM
            <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onUpload}
            disabled={busy}
            className="rounded-md border border-ink bg-surface px-5 py-3 text-[15.5px] font-medium text-ink transition-colors hover:bg-sunken disabled:opacity-60"
          >
            Upload your RCM
          </button>
          <button
            type="button"
            onClick={() => onDemo("ai")}
            disabled={busy}
            data-testid="try-ai-pack"
            className="rounded-md border border-accent/50 bg-accent-soft/50 px-5 py-3 text-[15.5px] font-medium text-accent-ink transition-colors hover:bg-accent-soft disabled:opacity-60"
          >
            AI systems controls pack
          </button>
          <a href="/rcm-template.xlsx" download className="px-1 text-[14px] text-accent underline decoration-accent/30 underline-offset-[3px] hover:decoration-accent">
            Download template
          </a>
        </div>
        <p className="mt-3 text-[13px] text-muted">Demo needs no key: 40 synthetic controls, results precomputed. Your own file: bring an OpenRouter key, or run rules-only.</p>
      </div>

      {/* Specimen */}
      <div className="self-center">
        <figure className="rounded-lg border border-rule bg-surface p-5 shadow-[0_1px_0_var(--rule)] sm:p-6">
          <figcaption className="flex items-center justify-between text-[12px] text-muted">
            <span className="font-mono">TRE-03 · Treasury / Payment release</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-fail-soft px-2 py-px font-medium text-fail ring-1 ring-fail/25 ring-inset">Fail</span>
          </figcaption>
          <p className="mt-3 font-serif text-[17px] leading-[1.75] text-ink">
            <Highlighted
              text={SPECIMEN}
              cites={[
                { start: 4, end: 20, kind: "ok", label: "Who ✓" },
                { start: 21, end: 42, kind: "fail", label: "Segregation of duties", n: 1 },
                { start: 68, end: 83, kind: "ok", label: "Precision ✓" },
              ]}
            />
          </p>
          <ol className="mt-4 space-y-2 border-t border-rule pt-3 text-[13.5px]">
            <li className="grid grid-cols-[20px_1fr] gap-1">
              <span className="font-mono text-[12px] text-fail">1</span>
              <span>
                <span className="font-semibold text-ink">Segregation of duties.</span> <span className="text-ink-2">The same role prepares and approves the payment.</span>
              </span>
            </li>
            <li className="grid grid-cols-[20px_1fr] gap-1">
              <span className="font-mono text-[12px] text-weak">2</span>
              <span>
                <span className="font-semibold text-ink">When — timing / trigger.</span> <span className="text-ink-2">No trigger stated; specify that approval occurs before the payment is released to the bank.</span>
              </span>
            </li>
          </ol>
        </figure>
        {evalHeadline && (
          <p className="mt-4 text-[13px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">Measured, not claimed.</span> On {evalHeadline.controls} synthetic controls with {evalHeadline.plantedDefects} planted
            defects: <span className="font-semibold text-ink tnum">{pct(evalHeadline.recall)}</span> recall,{" "}
            <span className="font-semibold text-ink tnum">{pct(evalHeadline.cleanFpRate)}</span> false positives on clean controls ({evalHeadline.model}).
            {holdout && (
              <>
                {" "}On an independent holdout ({holdout.controls} controls by another model family, a third in German):{" "}
                <span className="font-semibold text-ink tnum">{pct(holdout.recall)}</span> recall,{" "}
                <span className="font-semibold text-ink tnum">{pct(holdout.cleanFpRate)}</span> false positives.
              </>
            )}{" "}
            <a href={`${GITHUB}#evaluation`} className="text-accent underline underline-offset-2">
              Methodology and limits
            </a>
          </p>
        )}
      </div>
    </section>
  );
}

function HowItWorks() {
  const items = [
    ["Six design attributes", "Who (a role), what (a concrete action), when (timing or trigger), frequency, evidence retained, and precision for review controls."],
    ["Six consistency rules", "Frequency in text vs. column, automated vs. manual steps, owner is a role, segregation of duties, risk link, evidence for key controls. Deterministic, no AI."],
    ["Traceable by design", "The model quotes the text; code locates the span. A quote that is not in your RCM is dropped, never shown."],
    ["Your data, your key", "Files are parsed in your browser. AI calls use your own OpenRouter key, forwarded per request and never stored."],
  ];
  return (
    <section className="border-t border-rule bg-surface/60">
      <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {items.map(([t, d]) => (
          <div key={t}>
            <h3 className="font-serif text-[18px] font-semibold text-ink">{t}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-6 sm:px-6" role="status" aria-live="polite">
      <div className="rounded-lg border border-rule bg-surface px-5 py-4">
        <div className="flex items-center justify-between text-[14px]">
          <span className="text-ink">{label}…</span>
          {total > 0 && (
            <span className="font-mono text-[13px] text-muted tnum">
              {done} / {total} controls
            </span>
          )}
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div
            className={`h-full rounded-full bg-accent transition-[width] duration-500 ${total ? "" : "w-1/3 animate-pulse"}`}
            style={total ? { width: `${Math.max(4, (done / total) * 100)}%` } : undefined}
          />
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-4 py-6 text-[12.5px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Personal project. Synthetic demo data. Not affiliated with any employer. Not audit advice.</p>
        <p>
          <a href={GITHUB} className="underline underline-offset-2 hover:text-ink">
            Open source
          </a>{" "}
          · Apache-2.0 · Made in Zurich
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex rounded-md border border-rule-strong bg-surface p-0.5" role="group" aria-label="Status">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`rounded-[5px] px-2.5 py-1 text-[13px] tnum transition-colors ${value === v ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunken"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  neutral = "all",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  neutral?: string;
}) {
  return (
    <label className="inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-md border bg-surface px-2.5 py-1.5 text-[13px] ${value !== neutral ? "border-ink text-ink" : "border-rule-strong text-ink-2"}`}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
