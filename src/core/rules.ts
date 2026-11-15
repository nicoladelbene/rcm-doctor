import { DEFAULT_SEVERITY, type Control, type Finding, type RuleCheckId } from "./schema";
import { spanAt } from "./spans";

/* ------------------------------------------------------------------ */
/* Frequency                                                           */
/* ------------------------------------------------------------------ */

export type Freq =
  | "continuous"
  | "event"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual";

/** Normalize a frequency column value. */
export function normalizeFrequency(v: string): Freq | null {
  const s = v.toLowerCase().trim();
  if (!s) return null;
  if (/(continu|real[- ]?time|automat|system[- ]enforced|ongoing)/.test(s)) return "continuous";
  if (/(event|ad[- ]?hoc|as (needed|required|occur)|per (transaction|occurrence|change|request|event)|each (transaction|occurrence)|recurring|multiple times|upon|when)/.test(s)) return "event";
  if (/(daily|day|täglich)/.test(s)) return "daily";
  if (/(weekly|week)/.test(s)) return "weekly";
  if (/(semi[- ]?annual|half[- ]?year|bi[- ]?annual|six[- ]month)/.test(s)) return "semiannual";
  if (/(quarter|qtr)/.test(s)) return "quarterly";
  if (/(month)/.test(s)) return "monthly";
  if (/(annual|year)/.test(s)) return "annual";
  return null;
}

/**
 * Explicit frequency words in free text. Deliberately narrow: "month-end" or
 * "year-end" describe a trigger, not a frequency, and are not matched.
 */
const FREQ_PATTERNS: { re: RegExp; freq: Freq }[] = [
  { re: /\b(daily|every (business |working )?day|each (business |working )?day|on a daily basis)\b/i, freq: "daily" },
  { re: /\b(weekly|every week|each week|on a weekly basis)\b/i, freq: "weekly" },
  { re: /\b(semi-annually|semi-annual|semiannually|half-yearly|every six months)\b/i, freq: "semiannual" },
  { re: /\b(quarterly|every quarter|each quarter|on a quarterly basis)\b/i, freq: "quarterly" },
  { re: /\b(monthly|every month|each month|on a monthly basis)\b/i, freq: "monthly" },
  { re: /\b(annually|yearly|every year|each year|once a year|on an annual basis)\b/i, freq: "annual" },
];

export function frequenciesInText(text: string): { freq: Freq; start: number; end: number }[] {
  const hits: { freq: Freq; start: number; end: number }[] = [];
  for (const { re, freq } of FREQ_PATTERNS) {
    const g = new RegExp(re.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = g.exec(text))) {
      // "semi-annually" also matches "annually": keep the longer, earlier match only.
      if (hits.some((h) => m!.index >= h.start && m!.index < h.end)) continue;
      hits.push({ freq, start: m.index, end: m.index + m[0].length });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

/* ------------------------------------------------------------------ */
/* Individual rules                                                    */
/* ------------------------------------------------------------------ */

function finding(check: RuleCheckId, message: string, span: Finding["evidence_span"]): Finding {
  return { check, severity: DEFAULT_SEVERITY[check], message, evidence_span: span, source: "rule" };
}

export function checkFrequencyMismatch(c: Control): Finding[] {
  const col = normalizeFrequency(c.frequency);
  if (!col || col === "continuous" || col === "event") return [];
  const hit = frequenciesInText(c.control_description).find((h) => h.freq !== col);
  if (!hit) return [];
  return [
    finding(
      "freq_mismatch",
      `Description says "${c.control_description.slice(hit.start, hit.end)}" but the frequency column says "${c.frequency}".`,
      spanAt("control_description", c.control_description, hit.start, hit.end),
    ),
  ];
}

const MANUAL_MARKERS =
  /\b(manually|manual(?! override)|reviews?|reviewed|signs?|signed|sign-off|initials|ticks?|prints?|spreadsheet|excel|e-?mails?|checks? (that|whether)|inspects?|visually|by hand)\b/i;

export function checkNatureMismatch(c: Control): Finding[] {
  const nature = c.nature.toLowerCase();
  if (!/automat/.test(nature) || /(it[- ]dependent|semi|manual)/.test(nature)) return [];
  const m = MANUAL_MARKERS.exec(c.control_description);
  if (!m) return [];
  return [
    finding(
      "nature_mismatch",
      `Nature is "${c.nature}", but the description describes a manual step ("${m[0]}").`,
      spanAt("control_description", c.control_description, m.index, m.index + m[0].length),
    ),
  ];
}

const ROLE_WORDS =
  /\b(manager|head|controller|accountant|officer|director|lead|team|analyst|clerk|cfo|ceo|cio|ciso|coo|treasurer|administrator|admin|specialist|coordinator|owner|committee|board|system|desk|department|function|supervisor|partner|assistant|engineer|architect|champion|steward|custodian|approver|preparer|reviewer|centre|center|group|services|operations|unit|payroll|desk|chief|vp|president|secretary|auditor|agent|keeper|planner|buyer|officer)\b/i;
const GENERIC_DEPARTMENTS = /^(finance|accounting|it|treasury|procurement|purchasing|sales|hr|operations|management|tbd|n\/a|na|-|various|all)$/i;
const PERSON_NAME = /^(?:[A-ZÄÖÜ][a-zäöüéèàçñ'’-]+|[A-Z]\.)(?:\s+(?:von|van|de|del|der|di|da|le|la)\b)?(?:\s+[A-ZÄÖÜ][a-zäöüéèàçñ'’-]+){1,2}$/;

export function checkOwner(c: Control): Finding[] {
  const owner = c.control_owner.trim();
  const span = owner ? spanAt("control_owner", c.control_owner, c.control_owner.indexOf(owner), c.control_owner.indexOf(owner) + owner.length) : null;
  if (!owner) return [finding("owner_invalid", "Control owner is empty.", null)];
  if (GENERIC_DEPARTMENTS.test(owner))
    return [finding("owner_invalid", `Owner "${owner}" is a department or placeholder, not an accountable role.`, span)];
  if (!ROLE_WORDS.test(owner) && PERSON_NAME.test(owner))
    return [finding("owner_invalid", `Owner "${owner}" looks like a person's name. Use a role, so the control survives staff changes.`, span)];
  return [];
}

const SOD_PATTERNS: RegExp[] = [
  // Verb forms only ("prepares ... and approves"), so nouns like "preparer and reviewer sign-offs" don't fire.
  /\b(prepares|creates|enters|initiates|raises|posts|records|inputs|sets up|maintains|processes|amends|changes|books)\s+(?:[\w/()-]+\s+){0,6}?and\s+(?:also\s+)?(approves|reviews|releases|authori[sz]es|signs off|signs)\b/i,
  /\b(approv|review|releas|authori[sz])\w*\s+(?:\w+\s+){0,3}?(?:his|her|their|its) own\b/i,
  /\bsame (person|individual|user|employee|role)\b[^.]*\b(approv|review|releas|prepar)/i,
  /\b(approv|review|releas|prepar)\w*[^.]*\bsame (person|individual|user|employee|role)\b/i,
];

export function checkSod(c: Control): Finding[] {
  for (const re of SOD_PATTERNS) {
    const m = re.exec(c.control_description);
    if (m)
      return [
        finding(
          "sod_conflict",
          "The same role appears to both perform and approve/review the activity. Separate preparer and reviewer.",
          spanAt("control_description", c.control_description, m.index, m.index + m[0].length),
        ),
      ];
  }
  return [];
}

const EMPTYISH = /^(|-|–|n\/?a|none|tbd|tbc|\?|nil|na)$/i;

export function checkRiskLink(c: Control): Finding[] {
  const out: Finding[] = [];
  if (EMPTYISH.test(c.risk_id.trim())) out.push(finding("missing_risk_link", "No risk ID: the control is not linked to a risk.", null));
  if (EMPTYISH.test(c.control_objective.trim()))
    out.push(finding("missing_risk_link", "Control objective is empty.", null));
  return out.slice(0, 1).map((f, i) => (out.length > 1 && i === 0 ? { ...f, message: "No risk ID and no control objective." } : f));
}

export function checkKeyEvidence(c: Control): Finding[] {
  if (!c.key_control || !EMPTYISH.test(c.evidence.trim())) return [];
  return [finding("key_no_evidence", "Key control with no evidence defined in the evidence column.", null)];
}

/* ------------------------------------------------------------------ */

export const RULES: Record<RuleCheckId, (c: Control) => Finding[]> = {
  freq_mismatch: checkFrequencyMismatch,
  nature_mismatch: checkNatureMismatch,
  owner_invalid: checkOwner,
  sod_conflict: checkSod,
  missing_risk_link: checkRiskLink,
  key_no_evidence: checkKeyEvidence,
};

export function runRules(c: Control): Finding[] {
  return Object.values(RULES).flatMap((rule) => rule(c));
}
