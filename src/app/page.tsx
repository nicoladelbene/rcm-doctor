import { readFileSync } from "node:fs";
import { join } from "node:path";
import { App, type EvalHeadline } from "./components/App";

function readEval(): EvalHeadline | null {
  try {
    const e = JSON.parse(readFileSync(join(process.cwd(), "docs/eval-latest.json"), "utf8"));
    return { controls: e.controls, plantedDefects: e.plantedDefects, recall: e.recall, cleanFpRate: e.cleanFpRate, model: e.model };
  } catch {
    return null;
  }
}

export default function Page() {
  return <App evalHeadline={readEval()} />;
}
