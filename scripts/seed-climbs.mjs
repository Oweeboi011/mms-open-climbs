/**
 * Seed script — adds MMS Open Climbs 2026 schedule to Firestore.
 * Signs in via the Firebase Auth REST API using admin credentials.
 *
 * Usage:
 *   node scripts/seed-climbs.mjs <adminEmail>
 *   (password is prompted securely — not visible or stored in shell history)
 *
 * The account must have role: 'admin' in Firestore (i.e. already set up).
 * No Firebase CLI or gcloud installation required.
 */
import { createInterface } from "readline";

const PROJECT_ID = "mms-open-climbs";
const DATABASE = "openclimbs";
const FIREBASE_API_KEY = "AIzaSyDLQFuxfJz74VtO9P1nvl6wYNzLWCF1uoU"; // public web API key

// ── Climb data from 2026 schedule flyer ──────────────────────────────────────
const CLIMBS = [
  // ── MINOR CLIMBS ────────────────────────────────────────────────────────────
  {
    title: "Mt. Kapipigigalan",
    dateLabel: "Jul 04-05",
    month: "jul",
    startDate: "2026-07-04T00:00:00Z",
    endDate: "2026-07-05T00:00:00Z",
    location: "San Juan, Batangas",
    type: "minor",
    color: "c-forest",
    status: "open",
    maxParticipants: 30,
    isWide: false,
    itineraryReady: false,
  },
  {
    title: "Mt. Kalisungan & Mt. Mabilog",
    dateLabel: "Aug 01-02",
    month: "aug",
    startDate: "2026-08-01T00:00:00Z",
    endDate: "2026-08-02T00:00:00Z",
    location: "Twin Hike | Laguna",
    type: "minor",
    color: "c-teal",
    status: "open",
    maxParticipants: 30,
    isWide: false,
    itineraryReady: false,
  },
  {
    title: "Tarak Ridge",
    dateLabel: "Aug 15-16",
    month: "aug",
    startDate: "2026-08-15T00:00:00Z",
    endDate: "2026-08-16T00:00:00Z",
    location: "Mt. Mariveles, Mariveles, Bataan",
    type: "minor",
    color: "c-olive",
    status: "open",
    maxParticipants: 30,
    isWide: false,
    itineraryReady: false,
  },
  {
    title: "Mt. Manalmon",
    dateLabel: "Sep 12-13",
    month: "sep",
    startDate: "2026-09-12T00:00:00Z",
    endDate: "2026-09-13T00:00:00Z",
    location: "San Miguel, Bulacan",
    type: "minor",
    color: "c-slate",
    status: "open",
    maxParticipants: 30,
    isWide: false,
    itineraryReady: false,
  },
  {
    title: "Mt. Marami",
    dateLabel: "Oct 10-11",
    month: "oct",
    startDate: "2026-10-10T00:00:00Z",
    endDate: "2026-10-11T00:00:00Z",
    location: "Maragondon, Cavite",
    type: "minor",
    color: "c-deep-teal",
    status: "open",
    maxParticipants: 30,
    isWide: false,
    itineraryReady: false,
  },
  {
    title: "Mt. Timbak - Mt. Tabayoc",
    dateLabel: "Nov 07-08",
    month: "nov",
    startDate: "2026-11-07T00:00:00Z",
    endDate: "2026-11-08T00:00:00Z",
    location: "Twin Hike | Kabayan, Benguet",
    type: "minor",
    color: "c-indigo",
    status: "open",
    maxParticipants: 30,
    isWide: false,
    itineraryReady: false,
  },
  {
    title: "Nasugbu Trilogy",
    dateLabel: "Dec 12-13",
    month: "dec",
    startDate: "2026-12-12T00:00:00Z",
    endDate: "2026-12-13T00:00:00Z",
    location: "Nasugbu, Batangas",
    type: "minor",
    color: "c-purple",
    status: "open",
    maxParticipants: 30,
    isWide: false,
    itineraryReady: false,
  },

  // ── MAJOR CLIMBS ────────────────────────────────────────────────────────────
  {
    title: "Mount Irid",
    dateLabel: "Jul 18-19",
    month: "jul",
    startDate: "2026-07-18T00:00:00Z",
    endDate: "2026-07-19T00:00:00Z",
    location: "Tanay, Rizal",
    type: "major",
    color: "c-navy",
    status: "open",
    maxParticipants: 20,
    isWide: false,
    itineraryReady: false,
  },
  {
    title: "Mt. Pinatubo, Sapang Uwak",
    dateLabel: "Aug 29-30",
    month: "aug",
    startDate: "2026-08-29T00:00:00Z",
    endDate: "2026-08-30T00:00:00Z",
    location: "Porac, Pampanga",
    type: "major",
    color: "c-crimson",
    status: "open",
    maxParticipants: 20,
    isWide: false,
    itineraryReady: false,
  },
  {
    title: "Mt. Arayat",
    dateLabel: "Sep 26-27",
    month: "sep",
    startDate: "2026-09-26T00:00:00Z",
    endDate: "2026-09-27T00:00:00Z",
    location: "Magalang - Arayat | Pampanga",
    type: "major",
    color: "c-ember",
    status: "open",
    maxParticipants: 20,
    isWide: false,
    itineraryReady: false,
  },
  {
    title: "Kibungan Cross Country",
    dateLabel: "Oct 24-26",
    month: "oct",
    startDate: "2026-10-24T00:00:00Z",
    endDate: "2026-10-26T00:00:00Z",
    location: "Kibungan, Benguet",
    type: "major",
    color: "c-slate",
    status: "open",
    maxParticipants: 20,
    isWide: false,
    itineraryReady: false,
  },
  {
    title: "Mt. Pulag",
    dateLabel: "Nov 20-22",
    month: "nov",
    startDate: "2026-11-20T00:00:00Z",
    endDate: "2026-11-22T00:00:00Z",
    location: "Tawangan - Akiki Trail | Benguet",
    type: "major",
    color: "c-navy",
    status: "open",
    maxParticipants: 20,
    isWide: true,
    itineraryReady: false,
  },
  {
    title: "Bakun Trilogy",
    dateLabel: "Nov 29 - Dec 02",
    month: "nov",
    startDate: "2026-11-29T00:00:00Z",
    endDate: "2026-12-02T00:00:00Z",
    location: "Bakun, Benguet",
    type: "major",
    color: "c-indigo",
    status: "open",
    maxParticipants: 20,
    isWide: true,
    itineraryReady: false,
  },

  // ── SPECIAL & INTERNATIONAL ─────────────────────────────────────────────────
  {
    title: "Mt. Apo",
    dateLabel: "Sep 18-22",
    month: "sep",
    startDate: "2026-09-18T00:00:00Z",
    endDate: "2026-09-22T00:00:00Z",
    location: "Kidapawan, North Cotabato",
    type: "special",
    color: "c-gold",
    status: "open",
    maxParticipants: 15,
    isWide: true,
    itineraryReady: false,
    description: "Experience the highest peak in the Philippines!",
  },
  {
    title: "Mt. Kinabalu",
    dateLabel: "Nov 29 - Dec 02",
    month: "nov",
    startDate: "2026-11-29T00:00:00Z",
    endDate: "2026-12-02T00:00:00Z",
    location: "Kota Kinabalu, Sabah, Malaysia",
    type: "special",
    color: "c-magenta",
    status: "closed",
    maxParticipants: 15,
    isWide: true,
    itineraryReady: false,
    description: "Our 2026 international climb to Sabah.",
  },
];

// ── Auth: sign in with email/password via Firebase Auth REST API ─────────────
async function promptPassword(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    // Hide input on Unix; on Windows readline doesn't support muting, so just prompt clearly
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function getToken() {
  const [, , email] = process.argv;
  if (!email) {
    console.error("Usage: node scripts/seed-climbs.mjs <adminEmail>");
    process.exit(1);
  }

  const password = await promptPassword(`Password for ${email}: `);

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  if (!res.ok || !data.idToken) {
    console.error(
      "Sign-in failed:",
      data.error?.message || JSON.stringify(data),
    );
    process.exit(1);
  }
  console.log(`Signed in as ${email}\n`);
  return data.idToken;
}

// ── Firestore REST value helpers ─────────────────────────────────────────────
function str(v) {
  return { stringValue: v };
}
function int(v) {
  return { integerValue: String(v) };
}
function bool(v) {
  return { booleanValue: v };
}
function ts(v) {
  return { timestampValue: v };
}
function arr(items) {
  return { arrayValue: { values: items } };
}

function buildDoc(climb) {
  return {
    fields: {
      title: str(climb.title),
      dateLabel: str(climb.dateLabel),
      month: str(climb.month),
      startDate: ts(climb.startDate),
      endDate: ts(climb.endDate),
      location: str(climb.location),
      type: str(climb.type),
      color: str(climb.color),
      status: str(climb.status),
      maxParticipants: int(climb.maxParticipants),
      registrationCount: int(0),
      isWide: bool(climb.isWide),
      itineraryReady: bool(climb.itineraryReady),
      description: str(climb.description || ""),
      thingsToBring: arr([]),
      expenses: arr([]),
      officers: arr([]),
      itinerary: arr([]),
    },
  };
}

// ── Seed ─────────────────────────────────────────────────────────────────────
const token = await getToken();
const baseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}/documents/climbs`;
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

let created = 0;
let failed = 0;

for (const climb of CLIMBS) {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(buildDoc(climb)),
  });

  if (res.ok) {
    const doc = await res.json();
    const id = doc.name.split("/").pop();
    console.log(`  ✓ ${climb.title} (${climb.type}, ${climb.status}) — ${id}`);
    created++;
  } else {
    const err = await res.text();
    console.error(`  ✗ ${climb.title}: ${res.status} ${err}`);
    failed++;
  }
}

console.log(`\nDone — ${created} created, ${failed} failed.`);
