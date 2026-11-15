"use client";
import { SHORT_LABELS, type Control, type Review } from "@/core/schema";
import { AutomationMeter, SEV_DOT, StatusPill } from "./bits";

export function ResultsTable({
  rows,
  onOpen,
  selectedId,
}: {
  rows: { control: Control; review: Review }[];
  onOpen: (id: string) => void;
  selectedId: string | null;
}) {
  if (rows.length === 0)
    return <div className="rounded-lg border border-dashed border-rule-strong bg-surface p-10 text-center text-muted">No controls match these filters.</div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
      <table className="w-full min-w-[920px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-rule-strong bg-sunken/60 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted">
            <th scope="col" className="w-[92px] px-4 py-2.5">Status</th>
            <th scope="col" className="w-[84px] px-3 py-2.5">ID</th>
            <th scope="col" className="px-3 py-2.5">Control</th>
            <th scope="col" className="w-[150px] px-3 py-2.5">Owner</th>
            <th scope="col" className="w-[104px] px-3 py-2.5">Frequency</th>
            <th scope="col" className="w-[44px] px-3 py-2.5 text-center">Key</th>
            <th scope="col" className="w-[230px] px-3 py-2.5">Findings</th>
            <th scope="col" className="w-[96px] px-4 py-2.5">Automation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ control: c, review: r }, i) => {
            const sel = selectedId === c.control_id;
            return (
              <tr
                key={c.control_id}
                data-testid="result-row"
                data-id={c.control_id}
                onClick={() => onOpen(c.control_id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(c.control_id))}
                tabIndex={0}
                aria-selected={sel}
                style={{ animationDelay: `${Math.min(i, 20) * 22}ms` }}
                className={`anim-rise cursor-pointer border-b border-rule align-top transition-colors last:border-b-0 hover:bg-accent-soft/40 focus-visible:bg-accent-soft/50 ${
                  sel ? "bg-accent-soft/60" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <StatusPill status={r.status} />
                </td>
                <td className="px-3 py-3 font-mono text-[12.5px] font-medium whitespace-nowrap text-ink">{c.control_id}</td>
                <td className="px-3 py-3">
                  <div className="text-[12px] text-muted">
                    {c.process}
                    {c.sub_process && <span className="text-rule-strong"> / </span>}
                    {c.sub_process}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-ink-2">{c.control_description}</div>
                </td>
                <td className="px-3 py-3 text-[13px] text-ink-2">{c.control_owner || <span className="italic text-muted">—</span>}</td>
                <td className="px-3 py-3 text-[13px] text-ink-2">{c.frequency || <span className="italic text-muted">—</span>}</td>
                <td className="px-3 py-3 text-center font-mono text-[12px] text-ink-2">{c.key_control ? "Y" : <span className="text-muted">N</span>}</td>
                <td className="px-3 py-3">
                  {r.findings.length === 0 ? (
                    <span className="text-[13px] text-muted">None</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {r.findings.slice(0, 4).map((f, k) => (
                        <span key={k} className="inline-flex items-center gap-1 rounded-[4px] border border-rule bg-paper px-1.5 py-px text-[12px] text-ink-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[f.severity]}`} aria-label={f.severity} />
                          {SHORT_LABELS[f.check]}
                        </span>
                      ))}
                      {r.findings.length > 4 && <span className="px-1 text-[12px] text-muted">+{r.findings.length - 4}</span>}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <AutomationMeter score={r.automation_score} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
