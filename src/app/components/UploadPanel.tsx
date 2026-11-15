"use client";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_MODEL, SUGGESTED_MODELS } from "@/core/models";
import { CONTROL_FIELDS, type Control, type ControlField } from "@/core/schema";
import type { ColumnMapping, ParseResult } from "@/core/parse";

const FIELD_LABEL: Record<ControlField, string> = {
  control_id: "Control ID",
  process: "Process",
  sub_process: "Sub-process",
  risk_id: "Risk ID",
  risk_description: "Risk description",
  control_objective: "Control objective",
  control_description: "Control description",
  control_owner: "Control owner",
  frequency: "Frequency",
  control_type: "Control type",
  nature: "Nature",
  key_control: "Key control",
  evidence: "Evidence",
  systems: "Systems",
  assertions: "Assertions",
};
const REQUIRED = new Set<ControlField>(["control_id", "control_description"]);
const MAX_CONTROLS = 300;
const MAX_BYTES = 5 * 1024 * 1024;

export interface RunRequest {
  controls: Control[];
  apiKey?: string;
  model: string;
  fileName: string;
}

export function UploadPanel({ onClose, onRun }: { onClose: () => void; onRun: (r: RunRequest) => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [customModel, setCustomModel] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) return setError("File is larger than 5 MB.");
    if (!/\.(xlsx|xlsm|xls|csv)$/i.test(file.name)) return setError("Please upload an .xlsx, .xls or .csv file.");
    try {
      const { parseRcm } = await import("@/core/parse");
      const buf = /\.csv$/i.test(file.name) ? await file.text() : await file.arrayBuffer();
      const r = parseRcm(buf, file.name);
      if (!r.headers.length) return setError("Could not find a header row in the first sheet.");
      setFileName(file.name);
      setParsed(r);
      setMapping(r.mapping);
    } catch (e) {
      setError(`Could not read the file: ${(e as Error).message}`);
    }
  }

  async function run() {
    if (!parsed || !fileName) return;
    const { rowsToControls } = await import("@/core/parse");
    const controls = rowsToControls(parsed.rows, mapping);
    if (!controls.length) return setError("No controls found with the current column mapping.");
    if (controls.length > MAX_CONTROLS) return setError(`This MVP reviews up to ${MAX_CONTROLS} controls per file (found ${controls.length}).`);
    onRun({ controls, apiKey: apiKey.trim() || undefined, model: customModel.trim() || model, fileName });
  }

  const missing = CONTROL_FIELDS.filter((f) => REQUIRED.has(f) && !mapping[f]);
  const rowCount = parsed?.rows.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <button type="button" aria-label="Close" onClick={onClose} className="anim-fade fixed inset-0 cursor-default bg-ink/30" />
      <div className="anim-rise relative w-full max-w-[760px] rounded-lg border border-rule-strong bg-paper shadow-[0_20px_60px_rgba(22,25,29,0.25)]">
        <div className="flex items-center justify-between border-b border-rule px-6 py-4">
          <h2 id="upload-title" className="font-serif text-[21px] font-semibold text-ink">
            Review your RCM
          </h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-[13px] text-ink-2 hover:bg-sunken">
            Close
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {/* Step 1 */}
          <Step n={1} title="Choose a file">
            <div
              onDragOver={(e) => (e.preventDefault(), setDrag(true))}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className={`flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-6 py-7 text-center transition-colors ${
                drag ? "border-accent bg-accent-soft" : "border-rule-strong bg-surface"
              }`}
            >
              {fileName ? (
                <p className="text-[14px] text-ink">
                  <span className="font-mono">{fileName}</span> · {rowCount} rows · {parsed?.headers.length} columns
                </p>
              ) : (
                <p className="text-[14px] text-ink-2">Drop an .xlsx or .csv here (first sheet, max 5 MB)</p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-md border border-ink bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-sunken"
                >
                  {fileName ? "Choose another file" : "Choose file"}
                </button>
                <a href="/rcm-template.xlsx" download className="text-[13px] text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
                  Download template
                </a>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xlsm,.xls,.csv"
                className="sr-only"
                data-testid="file-input"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <p className="text-[12px] text-muted">Parsed in your browser. Use synthetic or anonymised data.</p>
            </div>
          </Step>

          {/* Step 2 */}
          {parsed && (
            <Step n={2} title="Confirm column mapping">
              <div className="grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
                {CONTROL_FIELDS.map((f) => (
                  <label key={f} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className={REQUIRED.has(f) ? "font-medium text-ink" : "text-ink-2"}>
                      {FIELD_LABEL[f]}
                      {REQUIRED.has(f) && <span className="text-fail"> *</span>}
                    </span>
                    <select
                      value={mapping[f] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value || undefined }))}
                      className={`w-[52%] truncate rounded-md border bg-surface px-2 py-1 text-[13px] ${mapping[f] ? "border-rule-strong text-ink" : "border-rule text-muted"}`}
                    >
                      <option value="">— not mapped —</option>
                      {parsed.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {missing.length > 0 && <p className="mt-2 text-[13px] text-fail">Map the required columns: {missing.map((m) => FIELD_LABEL[m]).join(", ")}.</p>}
            </Step>
          )}

          {/* Step 3 */}
          {parsed && (
            <Step n={3} title="AI review (optional)">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-[13px]">
                  <span className="font-medium text-ink">OpenRouter API key</span>
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-or-…"
                    className="mt-1 w-full rounded-md border border-rule-strong bg-surface px-2.5 py-1.5 font-mono text-[13px]"
                  />
                  <span className="mt-1 block text-[12px] leading-snug text-muted">
                    Kept in this tab only. Sent per request to our API, which forwards it to OpenRouter. Never logged or stored.{" "}
                    <a className="text-accent underline underline-offset-2" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
                      Get a key
                    </a>
                  </span>
                </label>
                <label className="block text-[13px]">
                  <span className="font-medium text-ink">Model</span>
                  <select value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 w-full rounded-md border border-rule-strong bg-surface px-2 py-1.5 text-[13px]">
                    {SUGGESTED_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} — {m.note}
                      </option>
                    ))}
                  </select>
                  <input
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="or any OpenRouter model id"
                    className="mt-2 w-full rounded-md border border-rule bg-surface px-2.5 py-1.5 font-mono text-[12.5px]"
                  />
                </label>
              </div>
              <p className="mt-3 text-[12.5px] text-ink-2">
                Without a key, rcm-doctor runs the six deterministic consistency rules only (instant, offline). With a key, it adds the six
                design-attribute checks, an automation score and a rewrite per control.
              </p>
            </Step>
          )}

          {error && <p className="rounded-md border border-fail/30 bg-fail-soft px-3 py-2 text-[13px] text-fail">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-rule px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-[14px] text-ink-2 hover:bg-sunken">
            Cancel
          </button>
          <button
            type="button"
            disabled={!parsed || missing.length > 0}
            onClick={run}
            className="rounded-md bg-ink px-4 py-2 text-[14px] font-medium text-paper hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {apiKey.trim() ? `Review ${rowCount || ""} controls with AI` : "Run rules-only review"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-2 text-[14px] font-semibold text-ink">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-ink/60 font-mono text-[11px]">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}
