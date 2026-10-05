// Bundle-size budget, run after `vite build`. Measures gzipped bytes because
// that is what crosses the wire. Budgets sit ~10% above today's sizes: raise
// them deliberately in review, never to make a red build green.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_KB = {
  // Entry script + everything index.html preloads: the cost of a first visit.
  initialLoad: 300,
  // Any one chunk (an admin page, a Firebase SDK piece). Raised from 85 for
  // firebase 12.15+: the Firestore SDK grew 74 → 126 kB (its Pipelines code
  // shares a module with the main entry and doesn't tree-shake; bisected
  // 12.14 → 12.19). Routes went lazy to keep initialLoad under budget.
  largestChunk: 135,
};

const DIST = "dist";
const kb = (bytes) => bytes / 1024;
const gz = (file) => gzipSync(readFileSync(join(DIST, file))).length;

const html = readFileSync(join(DIST, "index.html"), "utf8");
const initial = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
const initialKb = kb(initial.reduce((sum, f) => sum + gz(f), 0));

const chunks = readdirSync(join(DIST, "assets"))
  .filter((f) => f.endsWith(".js"))
  .map((f) => ({ file: f, size: kb(gz(join("assets", f))) }))
  .sort((a, b) => b.size - a.size);
const largest = chunks[0];

const rows = [
  ["initial load", initialKb, BUDGET_KB.initialLoad],
  [`largest chunk (${largest.file})`, largest.size, BUDGET_KB.largestChunk],
];
let failed = false;
for (const [label, actual, budget] of rows) {
  const ok = actual <= budget;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${actual.toFixed(1)} kB gzip (budget ${budget} kB)`);
}
if (failed) {
  console.error("\nBundle budget exceeded — see docs/guides/CODE-QUALITY.md (Performance).");
  process.exit(1);
}
