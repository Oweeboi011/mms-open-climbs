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
    // Reuses workers across files; each file still gets its own VM context.
    // ~35% faster than the default — see docs/guides/TESTING.md.
    pool: "vmThreads",
    // More workers past ~4 only add RAM (15 workers: 4 GB, slower). Measured.
    maxWorkers: 4,
    // functions/ has its own Jest suite; integration (emulator) and e2e
    // (Playwright) run through their own scripts — see docs/guides/TESTING.md.
    exclude: ["**/node_modules/**", "**/functions/**", "tests/integration/**", "tests/e2e/**"],
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
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@tests": resolve(__dirname, "./tests"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Firebase split by package, React runtime on its own: each changes
        // on its own schedule, so the others stay cached.
        manualChunks(id) {
          // Last node_modules segment: firebase nests its own @firebase/* copies.
          const pkg = id.match(/.*node_modules[\\/](@[^\\/]+[\\/][^\\/]+|[^\\/]+)/)?.[1]?.replace("\\", "/");
          if (!pkg) return undefined;
          if (["@firebase/app", "@firebase/app-check", "@firebase/component", "@firebase/util", "@firebase/logger"].includes(pkg)) return "firebase-app";
          if (pkg === "@firebase/auth") return "firebase-auth";
          if (pkg === "@firebase/firestore") return "firebase-firestore";
          if (pkg === "@firebase/functions") return "firebase-functions";
          if (["react", "react-dom", "react-router", "react-router-dom", "scheduler"].includes(pkg)) return "vendor";
          return undefined;
        },
      },
    },
  },
});
