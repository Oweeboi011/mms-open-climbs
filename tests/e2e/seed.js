// Seeds the emulators through their REST APIs with the "owner" token, which
// bypasses security rules, so no admin SDK is needed at the repo root.
export const E2E_CLIMB = { id: "e2e-climb", title: "Mt. E2E Smoke" };

const FIRESTORE =
  "http://127.0.0.1:8080/v1/projects/demo-e2e/databases/openclimbs/documents";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const OWNER = { "Content-Type": "application/json", Authorization: "Bearer owner" };

const value = (v) => {
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  if (v && typeof v === "object") return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
};
const toFields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, value(v)]));

async function post(url, body, what) {
  const res = await fetch(url, { method: "POST", headers: OWNER, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${what} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function putDoc(path, data) {
  const res = await fetch(`${FIRESTORE}/${path}`, {
    method: "PATCH",
    headers: OWNER,
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`Seeding ${path} failed: ${res.status} ${await res.text()}`);
}

// An admin account: the users/ role the app and the rules read, plus the
// custom claim Storage rules read (normally issued by a Cloud Function, which
// the e2e run doesn't emulate).
export async function createAdmin(email, password) {
  const { localId } = await post(
    `${AUTH}/accounts:signUp?key=demo-key`,
    { email, password, returnSecureToken: true },
    "Creating the admin",
  );
  await post(
    `${AUTH}/projects/demo-e2e/accounts:update`,
    { localId, customAttributes: JSON.stringify({ admin: true }) },
    "Setting the admin claim",
  );
  await putDoc(`users/${localId}`, { name: "Ada Admin", email, role: "admin", createdAt: new Date() });
  return localId;
}

export default async function seed() {
  const start = new Date(Date.now() + 30 * 86400000);
  await putDoc(`climbs/${E2E_CLIMB.id}`, {
    title: E2E_CLIMB.title,
    status: "open",
    type: "minor",
    month: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"][start.getMonth()],
    dateLabel: "E2E Weekend",
    location: "Rizal",
    startDate: start,
    endDate: start,
    maxParticipants: 20,
    registrationCount: 0,
  });
}
