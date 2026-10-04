import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.js"],
    css: false,
    // Exclude CommonJS Jest tests in functions/ — run those with `npm test` inside functions/
    exclude: ["**/node_modules/**", "**/functions/**", "**/rules-tests/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx"],
      // Ratchets, like the ESLint ceilings — set just under today's actuals
      // (lines 78.5 / functions 71 / statements 77.5 / branches 66.3).
      // Raise them when coverage improves; never lower them.
      thresholds: {
        lines: 78,
        functions: 70,
        statements: 77,
        branches: 66,
      },
    },
  },
  // Serve the images/ folder as static assets at /images/
  publicDir: "images",
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@tests": resolve(__dirname, "./tests"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Firebase SDK split by package
          "firebase-app": ["firebase/app", "firebase/app-check"],
          "firebase-auth": ["firebase/auth"],
          "firebase-firestore": ["firebase/firestore"],
          "firebase-functions": ["firebase/functions"],
          // React runtime
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
