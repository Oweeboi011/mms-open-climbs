import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";
import boundaries from "eslint-plugin-boundaries";

// Size / complexity ceilings. These are ratchets, not aspirations: each number
// sits just above today's worst offender so the codebase cannot get worse, and
// gets lowered as files are split. See docs/wiki/CODE-QUALITY.md.
const CEILINGS = {
  fileLines: 2100, // worst today: Event.jsx (2096)
  functionLines: 1950, // worst today: Event() (1938)
  complexity: 115, // worst today: Event() (112)
  params: 6,
  depth: 5,
};

// The direction the dependency graph is allowed to flow. Anything not listed
// here is an error — see the `boundaries/element-types` rule below.
const LAYERS = [
  { type: "pages", pattern: "src/pages/**", mode: "full" },
  { type: "components", pattern: "src/components/**", mode: "full" },
  { type: "contexts", pattern: "src/contexts/**", mode: "full" },
  { type: "hooks", pattern: "src/hooks/**", mode: "full" },
  { type: "utils", pattern: "src/utils/**", mode: "full" },
  { type: "infra", pattern: "src/firebase/**", mode: "full" },
  { type: "data", pattern: "src/data/**", mode: "full" },
  { type: "styles", pattern: "src/styles/**", mode: "full" },
  { type: "app", pattern: "src/{App,main}.jsx", mode: "full" },
];

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "functions/**",
      ".firebase/**",
      "js/**",
      "public/**",
      "images/**",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: {
      react: { version: "18.3" },
      "import/resolver": {
        node: { extensions: [".js", ".jsx"] },
      },
      "boundaries/elements": LAYERS,
      "boundaries/ignore": ["tests/**", "scripts/**"],
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      import: importPlugin,
      boundaries,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,

      // --- Correctness -------------------------------------------------
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": "error",
      "react/prop-types": "off",

      // Only flag characters that actually break JSX parsing in confusing
      // ways. Apostrophes in user-facing copy are fine and we have hundreds.
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],

      // React Compiler / purity rules (eslint-plugin-react-hooks v6). Real
      // signal, but every current hit needs a behavioural refactor, so they
      // are advisory until those are worked through — see ADR 0002.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/static-components": "warn",

      // --- Dangerous / insecure patterns -------------------------------
      // Complements the Semgrep + CodeQL passes in CI; these are the ones
      // worth failing fast on locally.
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "react/no-danger": "error",
      "react/jsx-no-target-blank": [
        "error",
        { allowReferrer: false, enforceDynamicLinks: "always" },
      ],

      // --- Banned imports ----------------------------------------------
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../*"],
              message:
                "Use the '@/' alias instead of climbing two or more directories.",
            },
          ],
        },
      ],
      "import/no-cycle": ["error", { maxDepth: Infinity }],
      "import/no-self-import": "error",
      "import/no-useless-path-segments": "error",

      // --- Size / complexity ceilings ----------------------------------
      "max-lines": [
        "error",
        { max: CEILINGS.fileLines, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        {
          max: CEILINGS.functionLines,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      complexity: ["error", CEILINGS.complexity],
      "max-params": ["error", CEILINGS.params],
      "max-depth": ["error", CEILINGS.depth],
    },
  },

  // --- Layering -------------------------------------------------------
  // Encodes the dependency direction from ADR 0002. Domain logic (utils)
  // must not reach up into UI or state; UI must not reach sideways into
  // pages.
  {
    files: ["src/**/*.{js,jsx}"],
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            {
              from: "app",
              allow: [
                "app",
                "pages",
                "components",
                "contexts",
                "hooks",
                "utils",
                "infra",
                "data",
                "styles",
              ],
            },
            {
              from: "pages",
              allow: [
                "pages",
                "components",
                "contexts",
                "hooks",
                "utils",
                "infra",
                "data",
                "styles",
              ],
            },
            {
              from: "components",
              allow: [
                "components",
                "contexts",
                "hooks",
                "utils",
                "infra",
                "data",
                "styles",
              ],
            },
            { from: "contexts", allow: ["contexts", "hooks", "utils", "infra"] },
            { from: "hooks", allow: ["contexts", "hooks", "utils", "infra"] },
            // utils is the domain layer: pure helpers plus a small set of
            // write-only logging helpers that need Firestore. It may never
            // import UI or state.
            { from: "utils", allow: ["utils", "infra"] },
            { from: "infra", allow: [] },
            { from: "data", allow: [] },
            { from: "styles", allow: [] },
          ],
        },
      ],
    },
  },

  // Tests and Node-side scripts play by looser rules.
  {
    files: ["tests/**/*.{js,jsx}"],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      "no-console": "off",
      "boundaries/element-types": "off",
    },
  },
  {
    files: ["scripts/**/*.{js,mjs}", "*.config.js", "*.config.mjs"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "no-console": "off",
      "boundaries/element-types": "off",
    },
  },
];
