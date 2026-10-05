import js from "@eslint/js";
import globals from "globals";
import eslintReact from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import importX from "eslint-plugin-import-x";
import boundaries from "eslint-plugin-boundaries";
import { readFileSync } from "node:fs";

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

// Files that still use inline `style={{…}}`. New code uses classes and the
// tokens in src/styles/globals.css. Shrink-only, like LEGACY: drop a file when
// its last inline style goes; never add one.
const INLINE_STYLE_LEGACY = JSON.parse(
  readFileSync(new URL("./tools/inline-styles-legacy.json", import.meta.url), "utf8"),
);

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

const NO_RAW_HTML = {
  selector: "AssignmentExpression > MemberExpression.left[property.name=/^(inner|outer)HTML$/]",
  message: "Render through React; raw HTML assignment is an XSS sink.",
};
// Inline styles: only CSS custom properties may be passed (for values that
// really are dynamic, e.g. style={{ "--pct": "40%" }}); the CSS reads them.
const STYLE_ATTR = "JSXOpeningElement[name.name=/^[a-z]/] > JSXAttribute[name.name='style'] > JSXExpressionContainer";
const INLINE_STYLE_MESSAGE =
  "Use a class and the tokens in src/styles/globals.css; pass dynamic values as CSS custom properties.";
const NO_INLINE_STYLE = [
  `${STYLE_ATTR} > :not(ObjectExpression)`,
  `${STYLE_ATTR} > ObjectExpression > SpreadElement`,
  `${STYLE_ATTR} > ObjectExpression > Property[key.type='Identifier']`,
  `${STYLE_ATTR} > ObjectExpression > Property[key.type='Literal'][key.value!=/^--/]`,
].map((selector) => ({ selector, message: INLINE_STYLE_MESSAGE }));

// @eslint-react re-implements the React Compiler hook rules; the official
// react-hooks plugin owns those, so drop the duplicates.
const HOOK_RULES = ["error-boundaries", "exhaustive-deps", "globals", "immutability", "purity", "refs",
  "rules-of-hooks", "set-state-in-effect", "set-state-in-render", "static-components", "unsupported-syntax", "use-memo"];
const REACT_RULES = Object.fromEntries(
  Object.entries(eslintReact.configs.recommended.rules).filter(
    ([name]) => !HOOK_RULES.includes(name.replace("@eslint-react/", "")),
  ),
);

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
      "public/**",
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
      "import/resolver": { node: { extensions: [".js", ".jsx"] } },
      "boundaries/elements": LAYERS,
    },
    plugins: { ...eslintReact.configs.recommended.plugins, "react-hooks": reactHooks, "import-x": importX, boundaries },
    rules: {
      ...REACT_RULES,
      // Index keys are right for the read-only lists here and for the
      // controlled-input row editors; a reorderable list needs an id.
      "@eslint-react/no-array-index-key": "off",
      ...reactHooks.configs.recommended.rules,

      // --- Correctness -------------------------------------------------
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": "error",

      // --- Naming ------------------------------------------------------
      // Firestore field names arrive as properties, hence "never".
      camelcase: ["error", { properties: "never", ignoreDestructuring: true, ignoreImports: true }],
      "@eslint-react/naming-convention-context-name": "error",
      "@eslint-react/naming-convention-ref-name": "error",

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
      "@eslint-react/dom-no-dangerously-set-innerhtml": "error",
      "@eslint-react/dom-no-unsafe-target-blank": "error",
      "@eslint-react/dom-no-script-url": "error",
      "no-restricted-properties": [
        "error",
        { object: "document", property: "write", message: "Never use document.write." },
      ],
      "no-restricted-syntax": ["error", NO_RAW_HTML],

      // --- Banned imports (cycles are dependency-cruiser's job) ----------
      "no-restricted-imports": ["error", { patterns: [NO_DEEP_RELATIVE] }],
      "import-x/no-self-import": "error",
      "import-x/no-useless-path-segments": "error",

      ...sizeRules(STRICT),
    },
  },

  // --- Clean Architecture: layering + Firebase only via services --------
  {
    files: ["src/**/*.{js,jsx}", "tests/**/*.{js,jsx}"],
    // Without this, boundaries silently skips every
    // '@/…' import — i.e. most of the graph.
    settings: {
      // Reads the "@/" and "@tests/" paths from jsconfig.json.
      "import/resolver": { typescript: { project: "./jsconfig.json" } },
      "import-x/resolver": { typescript: { project: "./jsconfig.json" } },
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
      // Design tokens and classes, not inline styles.
      "no-restricted-syntax": ["error", NO_RAW_HTML, ...NO_INLINE_STYLE],
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
  { files: INLINE_STYLE_LEGACY, rules: { "no-restricted-syntax": ["error", NO_RAW_HTML] } },

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
    files: ["scripts/**/*.mjs", "tools/**/*.{mjs,cjs}", "*.config.{js,mjs,cjs}", "functions/*.cjs"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "no-console": "off" },
  },
];
