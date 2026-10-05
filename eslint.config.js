import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";
import boundaries from "eslint-plugin-boundaries";

// Size / complexity limits every file must meet. See
// docs/guides/CODE-QUALITY.md and ADR 0003.
const STRICT = { fileLines: 600, functionLines: 200, complexity: 20, depth: 4, params: 6 };

// Files that predate STRICT, pinned at their measured worst. A number here may
// only go down: lower it (or delete the entry) when a file is split, never
// raise it. New files never belong here.
const LEGACY = {
  "src/components/admin/AddJoinerModal.jsx": {functionLines: 375},
  "src/components/admin/ClimbOverviewCard.jsx": {complexity: 26},
  "src/components/admin/ClimbPaymentCard.jsx": {functionLines: 941, fileLines: 954},
  "src/components/admin/MemberProfile.jsx": {functionLines: 229, complexity: 27},
  "src/components/admin/PaymentHistory.jsx": {functionLines: 298, complexity: 30},
  "src/components/admin/RegistrantRow.jsx": {functionLines: 805, complexity: 56, fileLines: 835},
  "src/components/admin/ServiceSharingCard.jsx": {functionLines: 267},
  "src/components/admin/SplitPaymentModal.jsx": {functionLines: 201},
  "src/components/ClimbCard.jsx": {complexity: 47},
  "src/components/EditRegistrationModal.jsx": {functionLines: 226, complexity: 24},
  "src/components/Header.jsx": {functionLines: 205, complexity: 22},
  "src/pages/admin/AllRegistrations.jsx": {functionLines: 1168, complexity: 30, fileLines: 1218},
  "src/pages/admin/Analytics.jsx": {functionLines: 1404, complexity: 24, fileLines: 1480},
  "src/pages/admin/AppInsights.jsx": {functionLines: 611, complexity: 43, fileLines: 708},
  "src/pages/admin/ClimbDaySheet.jsx": {functionLines: 223, complexity: 21},
  "src/pages/admin/ClimbDetail.jsx": {functionLines: 1285, complexity: 45, fileLines: 1375},
  "src/pages/admin/ClimbDonations.jsx": {functionLines: 314},
  "src/pages/admin/ClimbsManage.jsx": {functionLines: 896, complexity: 40, fileLines: 930},
  "src/pages/admin/Dashboard.jsx": {functionLines: 942, complexity: 33, fileLines: 1052},
  "src/pages/admin/ManagePayments.jsx": {functionLines: 388},
  "src/pages/admin/ReleaseNoteForm.jsx": {functionLines: 361, complexity: 37},
  "src/pages/admin/UsersManage.jsx": {functionLines: 860, complexity: 36, fileLines: 955},
  "src/pages/ClimbFeedback.jsx": {complexity: 24},
  "src/pages/MyRegistrations.jsx": {functionLines: 759, complexity: 55, fileLines: 1611},
  "src/pages/Schedule.jsx": {functionLines: 333},
  "src/utils/climbDaySheet.js": {complexity: 22},
  "src/utils/climbSetup.js": {complexity: 24},
  "src/utils/donations.js": {complexity: 36},
  "src/utils/markdownLite.jsx": {complexity: 26},
  "src/utils/payments.js": {complexity: 21},
  "functions/src/callables/users.js": {complexity: 22},
  "functions/src/scheduled/reminders.js": {functionLines: 248, complexity: 77},
  "functions/src/shared/registrationOps.js": {complexity: 31},
  "functions/src/triggers/climbs.js": {complexity: 30},
  "functions/src/triggers/registrations.js": {functionLines: 284, complexity: 69},
};

const LAYERS = [
  { type: "pages", pattern: "src/pages/**", partialMatch: false },
  { type: "components", pattern: "src/components/**", partialMatch: false },
  { type: "contexts", pattern: "src/contexts/**", partialMatch: false },
  { type: "hooks", pattern: "src/hooks/**", partialMatch: false },
  { type: "services", pattern: "src/services/**", partialMatch: false },
  { type: "utils", pattern: "src/utils/**", partialMatch: false },
  { type: "infra", pattern: "src/firebase/**", partialMatch: false },
  { type: "data", pattern: "src/data/**", partialMatch: false },
  { type: "styles", pattern: "src/styles/**", partialMatch: false },
];

// Who may import whom. Anything not listed is an error. src/App.jsx and
// src/main.jsx are the composition root and stay unclassified.
const ALLOWED = {
  pages: ["pages", "components", "contexts", "hooks", "services", "utils", "data", "styles"],
  components: ["components", "contexts", "hooks", "services", "utils", "data", "styles"],
  contexts: ["contexts", "hooks", "services", "utils", "data"],
  hooks: ["contexts", "hooks", "services", "utils", "data"],
  // The only layer that talks to Firebase (infra) — ADR 0004.
  services: ["services", "utils", "infra", "data"],
  // Pure domain logic: no UI, no state, no I/O.
  utils: ["utils", "data"],
  infra: [],
  data: [],
  styles: [],
};

const NO_DEEP_RELATIVE = {
  group: ["../../*"],
  message: "Use the '@/' alias instead of climbing two or more directories.",
};
const NO_FIREBASE_SDK = {
  group: ["firebase/*", "@/firebase/*", "**/firebase/config"],
  message: "Reach Firebase through src/services (ADR 0004).",
};

const sizeRules = (c) => ({
  "max-lines": ["error", { max: c.fileLines, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["error", { max: c.functionLines, skipBlankLines: true, skipComments: true }],
  complexity: ["error", c.complexity],
  "max-depth": ["error", c.depth],
  "max-params": ["error", STRICT.params],
});

const legacyOverrides = Object.entries(LEGACY).map(([file, ceilings]) => ({
  files: [file],
  rules: sizeRules({ ...STRICT, ...ceilings }),
}));

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "functions/node_modules/**",
      "functions/coverage/**",
      "functions/appShell.generated.js",
      ".firebase/**",
      "images/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.{js,jsx,mjs}"],
    linterOptions: { reportUnusedDisableDirectives: "error" },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: {
      react: { version: "18.3" },
      "import/resolver": { node: { extensions: [".js", ".jsx"] } },
      "boundaries/elements": LAYERS,
    },
    plugins: { react, "react-hooks": reactHooks, import: importPlugin, boundaries },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,

      // --- Correctness -------------------------------------------------
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": "error",
      "react/prop-types": "off",
      // Apostrophes in user-facing copy are fine; only flag what breaks JSX.
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],

      // React Compiler purity rules: real signal, but every current hit needs
      // a behavioural refactor, so advisory for now — see ADR 0002.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/static-components": "warn",

      // --- Dangerous / insecure patterns -------------------------------
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "react/no-danger": "error",
      "react/jsx-no-target-blank": ["error", { allowReferrer: false, enforceDynamicLinks: "always" }],
      "no-restricted-properties": [
        "error",
        { object: "document", property: "write", message: "Never use document.write." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "AssignmentExpression > MemberExpression.left[property.name=/^(inner|outer)HTML$/]",
          message: "Render through React; raw HTML assignment is an XSS sink.",
        },
      ],

      // --- Banned imports (cycles are dependency-cruiser's job) ----------
      "no-restricted-imports": ["error", { patterns: [NO_DEEP_RELATIVE] }],
      "import/no-self-import": "error",
      "import/no-useless-path-segments": "error",

      ...sizeRules(STRICT),
    },
  },

  // --- Clean Architecture: layering + Firebase only via services --------
  {
    files: ["src/**/*.{js,jsx}", "tests/**/*.{js,jsx}"],
    // Without this, boundaries silently skips every
    // '@/…' import — i.e. most of the graph.
    settings: {
      "import/resolver": {
        alias: { map: [["@", "./src"], ["@tests", "./tests"]], extensions: [".js", ".jsx"] },
        node: { extensions: [".js", ".jsx"] },
      },
    },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: Object.entries(ALLOWED).map(([from, to]) => ({
            from: { element: { type: from } },
            allow: { to: { element: { types: { anyOf: to } } } },
          })),
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Use src/services/browserStorage.js." },
        { name: "sessionStorage", message: "Use src/services/browserStorage.js." },
      ],
    },
  },
  {
    files: ["src/**/*.{js,jsx}"],
    ignores: ["src/firebase/**", "src/services/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [NO_DEEP_RELATIVE, NO_FIREBASE_SDK] }],
    },
  },
  {
    files: ["src/services/browserStorage.js"],
    rules: { "no-restricted-globals": "off" },
  },

  ...legacyOverrides,

  // --- Cloud Functions (CommonJS, Node) ---------------------------------
  {
    files: ["functions/**/*.js"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node } },
    rules: { "no-console": "off" },
  },
  {
    files: ["functions/scripts/**/*.mjs"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "no-console": "off" },
  },

  // --- Tests and Node-side scripts play by looser rules -----------------
  {
    files: ["tests/**/*.{js,jsx,mjs}", "functions/tests/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.vitest, ...globals.jest } },
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      complexity: "off",
      "max-depth": "off",
      "no-console": "off",
      "no-restricted-globals": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs", "*.config.{js,mjs,cjs}", "functions/*.cjs"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "no-console": "off" },
  },
];
