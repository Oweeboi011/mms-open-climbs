/**
 * Graph-level architecture rules. ESLint enforces the same layering per-file
 * (eslint-plugin-boundaries); dependency-cruiser is what catches the things
 * only visible from the whole graph — cycles of any length, orphans, and
 * reachability. See docs/wiki/CODE-QUALITY.md and ADR 0002.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "A cycle means neither module can be understood, tested, or moved on its own.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment: "Module is imported by nothing — dead code or a missing wire-up.",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)\\.[^/]+\\.(js|cjs|mjs|json)$", // dotfiles / configs
          "\\.d\\.ts$",
          "(^|/)(vite|eslint)\\.config\\.(js|mjs|cjs)$",
          "^src/main\\.jsx$",
          "^src/styles/",
        ],
      },
      to: {},
    },
    {
      name: "utils-stay-domain",
      severity: "error",
      comment:
        "src/utils is the domain layer: pure helpers plus write-only logging. It must never reach up into UI or React state.",
      from: { path: "^src/utils/" },
      to: { path: "^src/(pages|components|contexts|hooks)/" },
    },
    {
      name: "components-not-pages",
      severity: "error",
      comment:
        "A shared component importing a route page inverts the composition direction and drags a whole screen into the bundle.",
      from: { path: "^src/components/" },
      to: { path: "^src/pages/" },
    },
    {
      name: "infra-is-a-leaf",
      severity: "error",
      comment:
        "src/firebase/config.js is initialisation only — it must not depend on app code.",
      from: { path: "^src/firebase/" },
      to: { path: "^src/(pages|components|contexts|hooks|utils|data)/" },
    },
    {
      name: "data-is-a-leaf",
      severity: "error",
      comment: "src/data holds static fixtures — no imports out of it.",
      from: { path: "^src/data/" },
      to: { path: "^src/" },
    },
    {
      name: "no-firebase-admin-in-frontend",
      severity: "error",
      comment:
        "firebase-admin is privileged server-side code and must never reach the browser bundle.",
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
      name: "not-to-unresolvable",
      severity: "error",
      comment:
        "Import target does not resolve — a typo, a deleted file, or a broken '@/' alias.",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "no-deprecated-core",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["core"], path: "^(punycode|domain|sys)$" },
    },
    {
      name: "not-to-dev-dep",
      severity: "error",
      comment:
        "Shipped code depending on a devDependency breaks the production install.",
      from: { path: "^src/", pathNot: "\\.test\\.(js|jsx)$" },
      to: { dependencyTypes: ["npm-dev"] },
    },
  ],

  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^(dist|coverage|node_modules|functions|js|public)/" },
    includeOnly: "^(src|tests|scripts)/",
    tsPreCompilationDeps: false,
    enhancedResolveOptions: {
      extensions: [".js", ".jsx", ".json"],
      mainFields: ["module", "main"],
    },
    // Mirror the Vite aliases so `@/…` imports resolve.
    webpackConfig: { fileName: "./vite.config.js" },
    reporterOptions: {
      dot: { collapsePattern: "^src/[^/]+" },
      archi: { collapsePattern: "^src/[^/]+" },
    },
  },
};
