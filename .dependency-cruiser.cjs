/**
 * Whole-graph rules only: cycles of any length, unresolvable imports, and
 * what may leak into the shipped bundle. Per-file layering is ESLint's job
 * (eslint-plugin-boundaries) and dead files are knip's — one check, one tool.
 * See docs/guides/CODE-QUALITY.md and ADR 0003.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "A cycle means neither module can be understood, tested, or moved on its own.",
      from: {},
      to: { circular: true },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment: "Import target does not resolve — a typo, a deleted file, or a broken '@/' alias.",
      from: {},
      to: { couldNotResolve: true, pathNot: "appShell[.]generated" },
    },
    {
      name: "no-firebase-admin-in-frontend",
      severity: "error",
      comment: "firebase-admin is privileged server-side code and must never reach the browser bundle.",
      from: { path: "^src/" },
      to: { path: "firebase-admin" },
    },
    {
      name: "src-not-into-tests-or-scripts",
      severity: "error",
      comment: "Production code must not import test helpers or CLI scripts.",
      from: { path: "^src/" },
      to: { path: "^(tests|scripts)/" },
    },
    {
      name: "not-to-dev-dep",
      severity: "error",
      comment: "Shipped code depending on a devDependency breaks the production install.",
      from: { path: "^src/" },
      to: { dependencyTypes: ["npm-dev"] },
    },
    {
      name: "no-deprecated-core",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["core"], path: "^(punycode|domain|sys)$" },
    },
  ],

  options: {
    doNotFollow: { path: "node_modules" },
    includeOnly: "^(src|tests|scripts|functions/src|functions/scripts)/",
    enhancedResolveOptions: {
      extensions: [".js", ".jsx", ".mjs", ".json"],
      mainFields: ["module", "main"],
    },
    // Mirror the Vite aliases so `@/…` imports resolve.
    webpackConfig: { fileName: "./vite.config.js" },
    reporterOptions: {
      dot: { collapsePattern: "^src/[^/]+" },
    },
  },
};
