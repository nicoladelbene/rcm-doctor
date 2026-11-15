import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadControls } from "@/core/parse";
import { ReviewRunSchema } from "@/core/schema";
import { TestScriptRunSchema } from "@/core/testscript";

/** Demo RCMs: the Week 1 demo ("demo") and the Week 6 AI systems controls pack ("ai"). */
const SETS = {
  demo: { rcm: "data/demo-rcm.xlsx", results: "data/demo-results.json", scripts: "data/demo-testscripts.json", mappings: null },
  ai: { rcm: "data/ai-pack-rcm.xlsx", results: "data/ai-pack-results.json", scripts: "data/ai-pack-testscripts.json", mappings: "data/ai-pack.mappings.json" },
} as const;

/** Demo bundle: the synthetic RCM + precomputed review run (+ test scripts and framework mappings when present). */
export function GET(req: Request) {
  const set = SETS[(new URL(req.url).searchParams.get("set") ?? "demo") as keyof typeof SETS] ?? SETS.demo;
  const root = process.cwd();
  const controls = loadControls(readFileSync(join(root, set.rcm)), set.rcm);
  const run = ReviewRunSchema.parse(JSON.parse(readFileSync(join(root, set.results), "utf8")));
  const tsPath = join(root, set.scripts);
  const testscripts = existsSync(tsPath) ? TestScriptRunSchema.parse(JSON.parse(readFileSync(tsPath, "utf8"))) : null;
  const mappings = set.mappings ? JSON.parse(readFileSync(join(root, set.mappings), "utf8")) : null;
  return Response.json({ controls, run, testscripts, mappings }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=86400" } });
}
