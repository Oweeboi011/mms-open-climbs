"use strict";

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  clearMocks: true,
  resetMocks: true,
  collectCoverageFrom: ["src/index.js"],
  coverageReporters: ["text", "lcov", "html"],
  // Ratchets — set just under today's actuals (83 / 68.22 / 74.19 / 83.14).
  // Raise them when coverage improves; see docs/wiki/CODE-QUALITY.md.
  coverageThreshold: {
    global: {
      branches: 68,
      functions: 74,
      lines: 83,
      statements: 83,
    },
  },
};
