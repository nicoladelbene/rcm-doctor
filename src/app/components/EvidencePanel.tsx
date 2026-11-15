"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  citationBoxes,
  CONCLUSION_LABELS,
  tableOf,
  type EvidenceFile,
  type EvidencePack,
  type EvidenceTest,
  type Tick,
  type TickResult,
} from "@/core/evidence";
import type { Control } from "@/core/schema";
import type { TestScript } from "@/core/testscript";
import { ingestFiles, offlineEvidenceTest, runEvidenceTest } from "../lib/evidence-client";
import { Highlighted, WithPlaceholders, type Cite } from "./Highlighted";

const GLYPH: Record<TickResult, string> = { tick: "✓", exception: "✗", not_evidenced: "?", n_a: "–" };
const RESULT_LABEL: Record<TickResult, string> = { tick: "Tick — attribute met", exception: "Exception", not_evidenced: "Not evidenced", n_a: "Not applicable" };
const CELL: Record<TickResult, string> = {
  tick: "bg-pass-soft text-pass hover:ring-pass/50",
  exception: "bg-fail text-white hover:ring-fail/60",
  not_evidenced: "bg-weak-soft text-weak hover:ring-weak/50",
  n_a: "bg-sunken text-muted hover:ring-rule-strong",
};
const BOX: Record<TickResult, string> = {
  tick: "border-pass bg-pass/10",
  exception: "border-fail bg-fail/15",
  not_evidenced: "border-weak bg-weak/10",
  n_a: "border-rule-strong bg-transparent",
};
const LAYER_NOTE: Record<EvidenceFile["layer"], string> = {
  generator: "Text layer generated with the document — boxes exact",
  "pdf-text": "The PDF's own text layer — boxes exact",
  csv: "CSV cells — exact",
  "model-ocr": "Transcribed by the vision model — boxes approximate",
};

export interface EvidenceRunner {
  apiKey?: string;
  model: string;
}

/** Week 3: tick & tie of every sampled item × test attribute, with boxes on the evidence and the source span. */
export function EvidencePanel({
  control,
  script,
  pack,
  test,
  runner,
  onResult,
}: {
  control: Control;
  script: TestScript | undefined;
  pack: EvidencePack | undefined;
  test: EvidenceTest | undefined;
  runner: EvidenceRunner;
  onResult: (pack: EvidencePack, test: EvidenceTest) => void;
}) {
  const firstSel = useMemo(() => {
    const t = test?.ticks.find((x) => x.result === "exception") ?? test?.ticks.find((x) => x.citation);
    return t ? { s: t.sample_id, a: t.attribute_id } : null;
  }, [test]);
  const [picked, setPicked] = useState<{ key: string; s: string; a: string } | null>(null);
  const testKey = `${control.control_id}:${test?.model}:${test?.ticks.length}`;
  const sel = picked?.key === testKey ? picked : firstSel;
  const tick = test?.ticks.find((t) => t.sample_id === sel?.s && t.attribute_id === sel?.a);
  const [fileOverride, setFileOverride] = useState<{ key: string; id: string } | null>(null);
  const shownFileId = fileOverride?.key === `${testKey}:${sel?.s}:${sel?.a}` ? fileOverride.id : (tick?.citation?.file_id ?? pack?.files[0]?.file_id);
  const shownFile = pack?.files.find((f) => f.file_id === shownFileId);

  if (!script || script.attributes.length === 0)
    return (
      <p className="rounded-md border border-dashed border-rule-strong bg-surface p-6 text-center text-[14px] text-muted">
        Evidence testing needs a test script with attributes. Draft test scripts first (with an OpenRouter key).
      </p>
    );

  const attr = script.attributes.find((a) => a.id === sel?.a);
  const exceptions = test?.ticks.filter((t) => t.result === "exception") ?? [];
  const select = (s: string, a: string) => setPicked({ key: testKey, s, a });

  return (
    <div className="space-y-7" data-testid="evidence">
      {test && pack ? (
        <>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)]">
        <div className="min-w-0 space-y-6">
          <Conclusion test={test} exceptions={exceptions.length} />

          {/* Matrix: sample items × attributes */}
          <section>
            <H>Tick &amp; tie · {test.samples.length} sampled items × {script.attributes.length} attributes</H>
            <div className="mt-2 max-h-[300px] overflow-auto rounded-md border border-rule bg-surface">
              <table className="w-full text-[13px]" data-testid="tick-matrix">
                <thead className="sticky top-0 z-[1] bg-sunken">
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
                    <th className="px-3 py-2 text-left">Sample item</th>
                    {script.attributes.map((a) => (
                      <th key={a.id} className="w-14 px-1 py-2 text-center font-mono" title={a.attribute}>
                        {a.id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {test.samples.map((s) => (
                    <tr key={s} className={`border-t border-rule ${sel?.s === s ? "bg-accent-soft/40" : ""}`}>
                      <td className="px-3 py-1.5 font-mono text-[12.5px] text-ink">{s}</td>
                      {script.attributes.map((a) => {
                        const t = test.ticks.find((x) => x.sample_id === s && x.attribute_id === a.id);
                        const r = t?.result ?? "not_evidenced";
                        const on = sel?.s === s && sel?.a === a.id;
                        return (
                          <td key={a.id} className="px-1 py-1 text-center">
                            <button
                              type="button"
                              onClick={() => select(s, a.id)}
                              aria-label={`${s} · ${a.id}: ${RESULT_LABEL[r]}`}
                              data-testid={`cell-${s}-${a.id}`}
                              data-result={r}
                              className={`h-7 w-10 rounded-[5px] text-[14px] font-semibold ring-offset-1 transition hover:ring-2 ${CELL[r]} ${on ? "ring-2 ring-ink" : ""}`}
                            >
                              {GLYPH[r]}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Legend />
          </section>

          {/* Selected item: result, note, quote, and what it ties to in the control description */}
          {tick && attr && (
            <section className="rounded-md border border-rule bg-surface p-4" data-testid="tick-detail">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-[13px] text-muted">
                  {tick.sample_id} · {attr.id}
                </span>
                <span className="font-medium text-ink">
                  <WithPlaceholders text={attr.attribute} />
                </span>
                <span className={`rounded-full px-2 py-px text-[11.5px] font-semibold ${CELL[tick.result]}`}>{RESULT_LABEL[tick.result]}</span>
              </div>
              <p className="mt-2 text-[13.5px] text-ink-2">{tick.note}</p>
              {tick.citation ? (
                <p className="mt-2 text-[13px] text-ink-2">
                  <span className="font-semibold text-ink">Evidence:</span> “<span className="font-mono text-[12.5px]">{tick.citation.text}</span>” —{" "}
                  {pack.files.find((f) => f.file_id === tick.citation!.file_id)?.name}
                  {(() => {
                    const f = pack.files.find((x) => x.file_id === tick.citation!.file_id);
                    const tk = f?.tokens.find((t) => t.id === tick.citation!.token_ids[0]);
                    return tk?.cell ? `, row ${tk.cell[0]}` : f && f.pages.length > 1 && tk ? `, page ${tk.page + 1}` : "";
                  })()}
                </p>
              ) : tick.result !== "n_a" ? (
                <p className="mt-2 text-[12.5px] text-weak">
                  No verified reference in the evidence{tick.unverified_quote ? ` (the model quoted “${tick.unverified_quote}”, which is not in the evidence — not shown as a box)` : ""}.
                </p>
              ) : null}
              <div className="mt-3 border-t border-rule pt-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Ties to the control description</div>
                <p className="mt-1 font-serif text-[15px] leading-[1.7] text-ink">
                  <Highlighted
                    text={control.control_description}
                    cites={attr.span ? ([{ start: attr.span.start, end: attr.span.end, kind: tick.result === "exception" ? "fail" : "test", label: `${attr.id}: ${attr.attribute}`, n: 1, tag: attr.id }] as Cite[]) : []}
                    active={1}
                  />
                </p>
                {!attr.span && <p className="mt-1 text-[12px] text-weak">This attribute is not stated in the description (see the test script).</p>}
              </div>
            </section>
          )}

        </div>

          {/* Evidence viewer, beside the matrix on wide screens */}
          <section className="min-w-0 self-start lg:sticky lg:top-[128px]">
            <div className="flex flex-wrap items-center gap-2">
              <H>Evidence</H>
              {pack.files.map((f) => (
                <button
                  key={f.file_id}
                  type="button"
                  onClick={() => setFileOverride({ key: `${testKey}:${sel?.s}:${sel?.a}`, id: f.file_id })}
                  className={`rounded-md border px-2 py-1 text-[12px] ${f.file_id === shownFileId ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-2 hover:bg-sunken"}`}
                >
                  {f.name}
                </button>
              ))}
            </div>
            {shownFile && (
              <>
                <p className="mt-1.5 text-[12px] text-muted">
                  {LAYER_NOTE[shownFile.layer]}
                  {shownFile.src && (
                    <>
                      {" · "}
                      <a className="underline hover:text-ink" href={shownFile.src} target="_blank" rel="noreferrer">
                        open original
                      </a>
                    </>
                  )}
                </p>
                <Viewer pack={pack} file={shownFile} test={test} tick={tick} sample={sel?.s} />
              </>
            )}
          </section>

        </div>
          <footer className="border-t border-rule pt-4 text-[12px] text-muted">
            {test.model === "none" ? "No AI run yet" : <>Tick &amp; tie by <span className="font-mono">{test.model}</span> · prompt <span className="font-mono">{test.prompt_version}</span></>} · a box is drawn only
            where the quoted text was found in the evidence by code · the conclusion is computed from the results, not by the model.
            {test.llm_error && <span className="text-fail"> · AI step failed: {test.llm_error}</span>}
          </footer>
        </>
      ) : (
        <p className="rounded-md border border-dashed border-rule-strong bg-surface p-5 text-[14px] text-muted">
          No evidence tested for this control yet. Upload the evidence for the sampled items below.
        </p>
      )}

      <UploadBox control={control} script={script} runner={runner} onResult={onResult} />
    </div>
  );
}

function Conclusion({ test, exceptions }: { test: EvidenceTest; exceptions: number }) {
  const tone =
    test.conclusion === "exceptions" ? "border-fail/30 bg-fail-soft/60 text-fail" : test.conclusion === "no_exceptions" ? "border-pass/30 bg-pass-soft/60 text-pass" : "border-weak/30 bg-weak-soft/60 text-weak";
  const counts = (r: TickResult) => test.ticks.filter((t) => t.result === r).length;
  return (
    <section className={`rounded-md border p-4 ${tone.split(" ").slice(0, 2).join(" ")}`} data-testid="evidence-conclusion">
      <div className={`text-[12px] font-semibold uppercase tracking-[0.08em] ${tone.split(" ")[2]}`}>
        {CONCLUSION_LABELS[test.conclusion]}
        {exceptions > 0 && ` · ${exceptions}`}
      </div>
      <p className="mt-1 text-[13.5px] text-ink-2">{test.summary}</p>
      <p className="mt-1.5 font-mono text-[12px] text-muted">
        {counts("tick")} ✓ · {counts("exception")} ✗ · {counts("not_evidenced")} ? · {counts("n_a")} n/a
      </p>
    </section>
  );
}

function Legend() {
  return (
    <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
      {(Object.keys(GLYPH) as TickResult[]).map((r) => (
        <span key={r} className="inline-flex items-center gap-1.5">
          <span className={`inline-flex h-4 w-5 items-center justify-center rounded-[3px] text-[11px] font-semibold ${CELL[r]}`}>{GLYPH[r]}</span>
          {RESULT_LABEL[r]}
        </span>
      ))}
      <span>· click a cell to see its evidence</span>
    </p>
  );
}

function Viewer({ pack, file, test, tick, sample }: { pack: EvidencePack; file: EvidenceFile; test: EvidenceTest; tick: Tick | undefined; sample?: string }) {
  const target = useRef<HTMLElement | null>(null);
  const [pagePick, setPagePick] = useState<{ key: string; n: number } | null>(null);
  const selKey = `${file.file_id}:${tick?.sample_id}:${tick?.attribute_id}`;
  useEffect(() => {
    // Scroll only the evidence box's own container, never the drawer.
    const el = target.current;
    const box = el?.closest(".overflow-auto");
    if (el && box) {
      const r = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      box.scrollTo({ top: box.scrollTop + r.top - b.top - b.height / 2 + r.height / 2, left: r.left < b.left || r.right > b.right ? box.scrollLeft + r.left - b.left - 60 : box.scrollLeft, behavior: "smooth" });
    }
  }, [selKey]);

  const strong = tick?.citation?.file_id === file.file_id ? tick : undefined;
  // Other results for the same sample item on this file: faint outlines for context.
  const context = test.ticks.filter((t) => t.sample_id === sample && t !== tick && t.citation?.file_id === file.file_id);

  if (file.kind === "csv") {
    const table = tableOf(file);
    const strongCells = new Set(strong?.citation?.token_ids ?? []);
    const contextCells = new Set(context.flatMap((t) => t.citation!.token_ids));
    const sampleRow = file.tokens.find((t) => t.text === sample)?.cell?.[0];
    return (
      <div className="mt-2 max-h-[calc(100vh-220px)] overflow-auto rounded-md border border-rule bg-surface" data-testid="evidence-csv">
        <table className="text-[12px]">
          <tbody>
            {table.map((row, r) => (
              <tr key={r} className={`${r === 0 ? "sticky top-0 z-[1] bg-sunken font-semibold text-ink-2" : "border-t border-rule"} ${r === sampleRow ? "bg-accent-soft/50" : ""}`}>
                <td className="px-2 py-1 text-right font-mono text-[11px] text-muted">{r || ""}</td>
                {row.map((c, ci) => {
                  const id = `${file.file_id}-r${r}c${ci}`;
                  const isStrong = strongCells.has(id);
                  return (
                    <td
                      key={ci}
                      ref={
                        isStrong
                          ? (el) => {
                              if (el) target.current = el;
                            }
                          : undefined
                      }
                      className={`whitespace-nowrap px-2 py-1 font-mono ${isStrong ? `outline-2 -outline-offset-2 ${strong!.result === "exception" ? "bg-fail-soft outline-fail" : "bg-pass-soft outline-pass"} outline` : contextCells.has(id) ? "bg-pass-soft/50" : ""}`}
                    >
                      {c}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const strongBoxes = citationBoxes(pack, strong?.citation ?? null);
  const contextBoxes = context.flatMap((t) => citationBoxes(pack, t.citation).map((b) => ({ ...b, t })));
  // One page at a time: the page of the selected box, else the page that shows the sample item, else page 1.
  const samplePage = file.tokens.find((t) => t.text === sample)?.page;
  const autoPage = strongBoxes[0]?.page ?? samplePage ?? 0;
  const pageKey = `${selKey}:${autoPage}`;
  const page = pagePick?.key === pageKey ? pagePick.n : autoPage;
  return (
    <div className="mt-2" data-testid="evidence-pages">
      {file.pages.length > 1 && (
        <div className="mb-2 flex items-center gap-1.5 text-[12px] text-muted">
          Page
          {file.pages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPagePick({ key: pageKey, n: i })}
              className={`h-6 min-w-6 rounded px-1.5 font-mono ${i === page ? "bg-ink text-paper" : "border border-rule-strong text-ink-2 hover:bg-sunken"}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
      {file.pages.map((p, i) => i !== page ? null : (
        <div key={i} className="relative max-h-[calc(100vh-200px)] overflow-auto rounded-md border border-rule bg-white shadow-sm">
        {/* Portrait pages are shown slightly zoomed so the text stays legible beside the matrix. */}
        <div className="relative" style={{ aspectRatio: `1 / ${p.aspect}`, width: p.aspect > 1 ? "135%" : "100%" }}>
          {p.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt={`${file.name}, page ${i + 1}`} className="absolute inset-0 h-full w-full" />
          )}
          {contextBoxes
            .filter((b) => b.page === i)
            .map((b, k) => (
              <Rect key={`c${k}`} box={b.box} className={`border ${b.t.result === "exception" ? "border-fail/60" : "border-pass/60"}`} title={`${b.t.attribute_id}: ${b.t.note}`} />
            ))}
          {strongBoxes
            .filter((b) => b.page === i)
            .map((b, k) => (
              <Rect
                key={`s${k}`}
                box={b.box}
                className={`border-2 ${BOX[strong!.result]} anim-fade`}
                title={`${strong!.attribute_id}: ${strong!.note}`}
                label={`${strong!.attribute_id} ${GLYPH[strong!.result]}`}
                labelClass={strong!.result === "exception" ? "bg-fail" : "bg-pass"}
                refCb={
                  k === 0
                    ? (el) => {
                        target.current = el;
                      }
                    : undefined
                }
              />
            ))}
        </div>
        </div>
      ))}
    </div>
  );
}

function Rect({
  box,
  className,
  title,
  label,
  labelClass,
  refCb,
}: {
  box: [number, number, number, number];
  className: string;
  title: string;
  label?: string;
  labelClass?: string;
  refCb?: (el: HTMLDivElement | null) => void;
}) {
  const pad = 0.004;
  return (
    <div
      ref={refCb}
      title={title}
      data-testid={label ? "evidence-box" : undefined}
      className={`absolute rounded-[3px] ${className}`}
      style={{ left: `${(box[0] - pad) * 100}%`, top: `${(box[1] - pad) * 100}%`, width: `${(box[2] + 2 * pad) * 100}%`, height: `${(box[3] + 2 * pad) * 100}%` }}
    >
      {label && <span className={`absolute top-1/2 left-full ml-1.5 -translate-y-1/2 whitespace-nowrap rounded-[3px] px-1 font-mono text-[10.5px] font-semibold leading-[16px] text-white ${labelClass}`}>{label}</span>}
    </div>
  );
}

function UploadBox({ control, script, runner, onResult }: { control: Control; script: TestScript; runner: EvidenceRunner; onResult: (p: EvidencePack, t: EvidenceTest) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [samples, setSamples] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiKey = runner.apiKey || key.trim();

  async function go() {
    setError(null);
    try {
      setBusy("Reading the evidence in your browser");
      const ef = await ingestFiles(files);
      const pack: EvidencePack = {
        control_id: control.control_id,
        samples: samples.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 50),
        files: ef,
      };
      if (!apiKey) {
        onResult(pack, offlineEvidenceTest(script, pack));
        return;
      }
      setBusy(`Tick & tie with ${runner.model}`);
      const r = await runEvidenceTest(control, script, pack, { apiKey, model: runner.model });
      onResult(r.pack, r.test);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-md border border-rule bg-sunken/40 p-4" data-testid="evidence-upload">
      <H>Test your own evidence for {control.control_id}</H>
      <p className="mt-1 text-[12.5px] text-ink-2">
        PDF, screenshot (PNG/JPG) or CSV, up to 3 files. PDFs and CSVs are read in your browser; the text layer (and screenshots) go to the model with your
        own OpenRouter key, which is never stored. Use synthetic or anonymised evidence only.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-[12.5px] text-ink-2">
          Evidence files
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.csv,application/pdf,image/png,image/jpeg,text/csv"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))}
            className="mt-1 block w-full text-[12.5px] file:mr-3 file:rounded-md file:border file:border-rule-strong file:bg-surface file:px-2.5 file:py-1"
            data-testid="evidence-files"
          />
        </label>
        <label className="text-[12.5px] text-ink-2">
          Sample items (ids as on the evidence, comma-separated; empty = let the agent find them)
          <input value={samples} onChange={(e) => setSamples(e.target.value)} placeholder="e.g. 2026-03, 2026-09" className="mt-1 block w-full rounded-md border border-rule-strong bg-surface px-2.5 py-1.5 text-[13px]" />
        </label>
        {!runner.apiKey && (
          <label className="text-[12.5px] text-ink-2 sm:col-span-2">
            OpenRouter API key (kept in this tab only; without it you only see the evidence and its text layer)
            <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-or-…" className="mt-1 block w-full rounded-md border border-rule-strong bg-surface px-2.5 py-1.5 font-mono text-[13px]" />
          </label>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!files.length || !!busy}
          onClick={go}
          className="rounded-md bg-ink px-3.5 py-2 text-[13px] font-medium text-paper disabled:opacity-40"
          data-testid="evidence-run"
        >
          {apiKey ? "Tick & tie" : "Show evidence (no key)"}
        </button>
        {busy && <span className="text-[12.5px] text-muted">{busy}…</span>}
        {error && <span className="text-[12.5px] text-fail">{error}</span>}
      </div>
    </section>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[12px] font-semibold uppercase tracking-[0.09em] text-ink-2">{children}</h3>;
}
