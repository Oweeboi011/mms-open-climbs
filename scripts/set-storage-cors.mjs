/**
 * Proxy script — delegates to functions/set-storage-cors.mjs which uses
 * the firebase-admin SDK already installed in ./functions.
 *
 * Run from repo root:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS='C:\path\to\serviceAccountKey.json'
 *   node scripts/set-storage-cors.mjs
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, "../functions/set-storage-cors.mjs");

const result = spawnSync(process.execPath, [target], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
