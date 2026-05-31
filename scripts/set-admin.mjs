/**
 * One-time script to set up temporary open rules + create admin user doc.
 * Run: node scripts/set-admin.mjs <uid> <displayName> <email>
 *
 * Gets a Firebase access token from the logged-in CLI session,
 * then uses the Firestore REST API to write the user doc directly.
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const PROJECT_ID = 'mms-open-climbs';
const DATABASE   = 'openclimbs';

const [,, uid, displayName, email] = process.argv;

if (!uid || !displayName || !email) {
  console.error('Usage: node scripts/set-admin.mjs <uid> <displayName> <email>');
  process.exit(1);
}

// Get access token from Firebase CLI config file
let token;
try {
  const configPath = process.env.APPDATA + '/firebase/config.json';
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const tokens = config.tokens;
  // Use refresh token to get access token
  const res = await fetch('https://securetoken.googleapis.com/v1/token?key=AIzaSyDLQFuxfJz74VtO9P1nvl6wYNzLWCF1uoU', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${tokens.refresh_token}`,
  });
  const data = await res.json();
  token = data.access_token || data.id_token;
} catch {
  console.error('Could not get token from Firebase config.');
  process.exit(1);
}

// Write user doc via Firestore REST API
const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}/documents/users/${uid}`;

const body = {
  fields: {
    displayName: { stringValue: displayName },
    email:       { stringValue: email },
    role:        { stringValue: 'admin' },
    addedBy:     { stringValue: 'self' },
  }
};

const res = await fetch(url, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

if (res.ok) {
  console.log(`✓ User ${email} (${uid}) set as admin in Firestore`);
} else {
  const err = await res.text();
  console.error('Failed:', res.status, err);
}
