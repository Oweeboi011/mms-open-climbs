"use strict";

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  clearMocks: true,
  resetMocks: true,
  collectCoverageFrom: ["src/index.js"],
  coverageReporters: ["text", "lcov", "html"],
  // Ratchets — set just under today's actuals (67.9 / 56.3 / 67.7 / 64.9).
  // Raise them when coverage improves; see docs/wiki/CODE-QUALITY.md.
  coverageThreshold: {
    global: {
      branches: 64,
      functions: 56,
      lines: 67,
      statements: 67,
    },
  },
};
