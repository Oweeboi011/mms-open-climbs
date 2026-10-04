import axe from "axe-core";

// jsdom has no layout or computed colours, so contrast and other
// rendering-dependent rules can't be judged here — those need a real browser.
const JSDOM_BLIND = ["color-contrast", "region"];

export async function a11yViolations(container) {
  const { violations } = await axe.run(container, {
    rules: Object.fromEntries(JSDOM_BLIND.map((id) => [id, { enabled: false }])),
  });
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}
