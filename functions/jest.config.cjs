"use strict";

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  clearMocks: true,
  // See tests/stubs/jwks-rsa.js.
  moduleNameMapper: { "^jwks-rsa$": "<rootDir>/tests/stubs/jwks-rsa.js" },
  resetMocks: true,
  collectCoverageFrom: ["src/**/*.js"],
  coverageReporters: ["text", "lcov", "html"],
  // Ratchets — set just under today's actuals (84.72 / 76.56 / 80.62 / 86.04).
  // Raise them when coverage improves; see docs/guides/CODE-QUALITY.md.
  coverageThreshold: {
    global: {
      branches: 76,
      functions: 80,
      lines: 85,
      statements: 84,
    },
  },
};
