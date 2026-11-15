import { readFileSync } from "node:fs";
import { join } from "node:path";
import { App, type EvalHeadline } from "./components/App";

function readEval(file: string): EvalHeadline | null {
  try {
    const e = JSON.parse(readFileSync(join(process.cwd(), "docs", file), "utf8"));
    return { controls: e.controls, plantedDefects: e.plantedDefects, recall: e.recall, cleanFpRate: e.cleanFpRate, model: e.model };
  } catch {
    return null;
  }
}

export default function Page() {
  return <App evalHeadline={readEval("eval-latest.json")} holdout={readEval("eval-holdout.json")} />;
}
