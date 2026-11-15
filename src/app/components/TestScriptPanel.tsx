"use client";
import { useState } from "react";
import type { Control } from "@/core/schema";
import type { TestScript } from "@/core/testscript";
import { Highlighted, WithPlaceholders, type Cite } from "./Highlighted";

/** Week 2: test of design + test of operating effectiveness for one control. */
export function TestScriptPanel({ control, script }: { control: Control; script: TestScript | undefined }) {
  const [active, setActive] = useState<number | null>(null);
  if (!script)
    return (
      <p className="rounded-md border border-dashed border-rule-strong bg-surface p-6 text-center text-[14px] text-muted">
        No test script yet. Use “Draft test scripts” above the table.
      </p>
    );

  const cites: Cite[] = script.attributes
    .map((a, i) => (a.span ? { start: a.span.start, end: a.span.end, kind: "test" as const, label: `${a.id}: ${a.attribute}`, n: i + 1, tag: a.id } : null))
    .filter(Boolean) as Cite[];

  return (
    <div className="space-y-7" data-testid="testscript">
      {/* Readiness + sample */}
      <section className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
        <div
          className={`rounded-md border p-4 ${script.toe_ready ? "border-pass/30 bg-pass-soft/60" : "border-fail/30 bg-fail-soft/60"}`}
        >
          <div className={`text-[12px] font-semibold uppercase tracking-[0.08em] ${script.toe_ready ? "text-pass" : "text-fail"}`}>
            {script.toe_ready ? "Ready for operating-effectiveness testing" : "Blocked: remediate the design first"}
          </div>
          {script.toe_ready ? (
            <p className="mt-1 text-[13.5px] text-ink-2">No high-severity design findings. Perform the walkthrough, then test the sample below.</p>
          ) : (
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13.5px] text-ink-2">
              {script.blockers.map((b, i) => (
                <li key={i}>{b.replace(/^(\w+): /, "")}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-md border border-rule bg-surface p-4">
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Sample size</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-serif text-[34px] leading-none font-semibold text-ink tnum" data-testid="sample-size">
              {script.sample.size ?? "—"}
            </span>
            <span className="text-[13px] text-muted">{script.sample.label}</span>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-snug text-ink-2">{script.sample.basis}</p>
        </div>
      </section>

      {/* Description with attribute spans */}
      <section>
        <H>What each test attribute traces to</H>
        <p className="mt-2 rounded-md border border-rule bg-surface px-4 py-3.5 font-serif text-[16px] leading-[1.75] text-ink">
          <Highlighted text={control.control_description} cites={cites} active={active} />
        </p>
      </section>

      {/* ToE attributes */}
      <section>
        <H>Test of operating effectiveness · per sampled item</H>
        <div className="mt-2 overflow-x-auto rounded-md border border-rule bg-surface">
          <table className="w-full min-w-[640px] text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-rule bg-sunken/60 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
                <th className="w-10 px-3 py-2">Attr.</th>
                <th className="px-3 py-2">Verify that…</th>
                <th className="px-3 py-2">Procedure</th>
                <th className="w-[26%] px-3 py-2">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {script.attributes.map((a, i) => (
                <tr
                  key={a.id}
                  onMouseEnter={() => setActive(i + 1)}
                  onMouseLeave={() => setActive(null)}
                  className="border-b border-rule align-top last:border-b-0 hover:bg-accent-soft/40"
                >
                  <td className="px-3 py-2.5 font-mono text-[12.5px] font-medium text-accent">{a.id}</td>
                  <td className="px-3 py-2.5 font-medium text-ink">
                    <WithPlaceholders text={a.attribute} />
                    {!a.span && <div className="mt-0.5 text-[11.5px] font-normal text-weak">Not stated in the description</div>}
                  </td>
                  <td className="px-3 py-2.5 text-ink-2">
                    <WithPlaceholders text={a.procedure} />
                  </td>
                  <td className="px-3 py-2.5 text-ink-2">
                    <WithPlaceholders text={a.evidence} />
                  </td>
                </tr>
              ))}
              {script.attributes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-muted">
                    Test attributes need an AI run (add an OpenRouter key).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[13px] text-ink-2">
          <span className="font-semibold text-ink">Exception:</span> <WithPlaceholders text={script.exception_definition} />
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <H>Population</H>
          <p className="mt-2 text-[13.5px] text-ink-2">
            <WithPlaceholders text={script.population} />
          </p>
        </div>
        <div>
          <H>Test of design · walkthrough</H>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13.5px] text-ink-2">
            {script.tod_steps.map((s, i) => (
              <li key={i}>
                <WithPlaceholders text={s} />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-rule pt-4 pb-2 text-[12px] text-muted">
        Drafted by <span className="font-mono">{script.model}</span> · prompt <span className="font-mono">{script.prompt_version}</span> · sample sizes are
        illustrative minimums by frequency; adjust to your methodology.
        {script.llm_error && <span className="text-fail"> · AI step failed: {script.llm_error}</span>}
      </footer>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[12px] font-semibold uppercase tracking-[0.09em] text-ink-2">{children}</h3>;
}
