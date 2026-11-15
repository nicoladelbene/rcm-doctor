import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadControls } from "@/core/parse";
import { ReviewRunSchema } from "@/core/schema";


/** Demo bundle: the synthetic RCM + precomputed review run. Built once, served statically. */
export function GET() {
  const root = process.cwd();
  const controls = loadControls(readFileSync(join(root, "data/demo-rcm.xlsx")), "demo-rcm.xlsx");
  const run = ReviewRunSchema.parse(JSON.parse(readFileSync(join(root, "data/demo-results.json"), "utf8")));
  return Response.json({ controls, run }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=86400" } });
}
