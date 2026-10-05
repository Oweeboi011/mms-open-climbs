// Fails when two stylesheets define the same class, e.g. a feature's
// colocated CSS accidentally restyling a global class. A compound override
// such as `.modal-card.signin-dialog` is deliberate and allowed.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = "src";
const files = readdirSync(ROOT, { recursive: true })
  .filter((f) => f.endsWith(".css"))
  .map((f) => join(ROOT, f));

const owners = new Map();
for (const file of files) {
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, selectors] of css.matchAll(/(?:^|\})\s*([^{}@]+)\{/g)) {
    for (const raw of selectors.split(",")) {
      const sel = raw.trim();
      if (/^\.[\w-]+\./.test(sel)) continue;
      const name = sel.match(/^\.([\w-]+)/)?.[1];
      if (!name) continue;
      if (!owners.has(name)) owners.set(name, new Set());
      owners.get(name).add(relative(".", file).split(sep).join("/"));
    }
  }
}

const clashes = [...owners].filter(([, where]) => where.size > 1);
for (const [name, where] of clashes) console.error(`.${name} is defined in ${[...where].join(", ")}`);
if (clashes.length) {
  console.error(`\n${clashes.length} class name(s) defined in more than one stylesheet — rename the feature's class.`);
  process.exit(1);
}
console.log(`css: ${owners.size} classes in ${files.length} stylesheets, no collisions`);
