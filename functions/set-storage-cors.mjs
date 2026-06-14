/**
 * Sets CORS configuration on the Firebase Storage bucket.
 *
 * Run from repo root:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccountKey.json"
 *   node scripts/set-storage-cors.mjs
 *
 * The bucket name is read from VITE_FIREBASE_STORAGE_BUCKET in .env (repo root),
 * or you can override it with the STORAGE_BUCKET env var.
 *
 * Prerequisites:
 *   1. Obtain a service account key from Firebase Console > Project Settings > Service Accounts
 *   2. Set env vars (PowerShell):
 *        $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\key.json"
 *   3. Ensure functions deps are installed: cd functions && npm install
 *
 * Alternative (requires Google Cloud SDK):
 *   gsutil cors set cors.json gs://<your-bucket>
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Read .env file from repo root to get the storage bucket name
function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => {
        const idx = line.indexOf("=");
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      }),
  );
}

const envVars = readEnvFile(resolve(repoRoot, ".env"));
const storageBucket =
  process.env.STORAGE_BUCKET || envVars.VITE_FIREBASE_STORAGE_BUCKET || "";

if (!storageBucket) {
  console.error(
    "Error: Could not determine the storage bucket name.\n\n" +
      "Options:\n" +
      "  A) Ensure VITE_FIREBASE_STORAGE_BUCKET is set in your .env file at the repo root.\n" +
      "  B) Set the STORAGE_BUCKET env var:\n" +
      "       $env:STORAGE_BUCKET = 'your-project.firebasestorage.app'\n" +
      "       node scripts/set-storage-cors.mjs\n\n" +
      "The bucket name is shown in Firebase Console > Storage > Files (top of the page).\n" +
      "It typically looks like: your-project-id.firebasestorage.app",
  );
  process.exit(1);
}

const corsConfig = JSON.parse(
  readFileSync(resolve(repoRoot, "cors.json"), "utf8"),
);

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error(
    "Error: GOOGLE_APPLICATION_CREDENTIALS is not set.\n\n" +
      "Steps:\n" +
      "  1. Go to Firebase Console > Project Settings > Service Accounts\n" +
      "  2. Click 'Generate new private key' and save the JSON file\n" +
      "  3. Run (PowerShell):\n" +
      "       $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\\path\\to\\key.json'\n" +
      "       node scripts/set-storage-cors.mjs\n\n" +
      "Or use gsutil if Google Cloud SDK is installed:\n" +
      `  gsutil cors set cors.json gs://${storageBucket}`,
  );
  process.exit(1);
}

console.log(`Using bucket: ${storageBucket}`);

if (!getApps().length) {
  initializeApp({
    credential: cert(credPath),
    storageBucket,
  });
}

const bucket = getStorage().bucket();

try {
  await bucket.setCorsConfiguration(corsConfig);
  console.log(`CORS configuration applied to bucket: ${bucket.name}`);
} catch (err) {
  console.error("Failed to set CORS:", err.message);
  if (err.message.includes("does not exist")) {
    console.error(
      "\nThe bucket name may be wrong. Check Firebase Console > Storage > Files.\n" +
        `Current value: ${storageBucket}\n` +
        "Override with: $env:STORAGE_BUCKET = 'correct-bucket-name'",
    );
  }
  process.exit(1);
}
