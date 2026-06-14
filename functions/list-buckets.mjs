/**
 * Lists Firebase Storage buckets and shows their internal GCS bucket IDs.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { GoogleAuth } from "google-auth-library";

const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const serviceAccount = JSON.parse(readFileSync(keyFile, "utf8"));
const projectId = serviceAccount.project_id;

const auth = new GoogleAuth({
  keyFile,
  scopes: [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase",
  ],
});
const client = await auth.getClient();
const token = (await client.getAccessToken()).token;

console.log(`Project ID: ${projectId}`);
console.log("Listing Firebase Storage buckets...\n");

const listResp = await fetch(
  `https://firebasestorage.googleapis.com/v1beta/projects/${projectId}/buckets`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const listBody = await listResp.json();

if (!listResp.ok) {
  console.error("Failed:", JSON.stringify(listBody, null, 2));
  process.exit(1);
}

console.log("Buckets:", JSON.stringify(listBody, null, 2));
