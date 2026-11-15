import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EvidencePackSchema, EvidenceRunSchema } from "@/core/evidence";
import { loadControls } from "@/core/parse";
import { ReviewRunSchema } from "@/core/schema";
import { TestScriptRunSchema } from "@/core/testscript";

/** Demo bundle: the synthetic RCM + precomputed review run (+ test scripts and evidence tests when present). */
export function GET() {
  const root = process.cwd();
  const controls = loadControls(readFileSync(join(root, "data/demo-rcm.xlsx")), "demo-rcm.xlsx");
  const run = ReviewRunSchema.parse(JSON.parse(readFileSync(join(root, "data/demo-results.json"), "utf8")));
  const tsPath = join(root, "data/demo-testscripts.json");
  const testscripts = existsSync(tsPath) ? TestScriptRunSchema.parse(JSON.parse(readFileSync(tsPath, "utf8"))) : null;
  const packsPath = join(root, "data/evidence/packs.json");
  const evPath = join(root, "data/demo-evidence-results.json");
  const evidence =
    existsSync(packsPath) && existsSync(evPath)
      ? { packs: EvidencePackSchema.array().parse(JSON.parse(readFileSync(packsPath, "utf8"))), run: EvidenceRunSchema.parse(JSON.parse(readFileSync(evPath, "utf8"))) }
      : null;
  return Response.json({ controls, run, testscripts, evidence }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=86400" } });
}
