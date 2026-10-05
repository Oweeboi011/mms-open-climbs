// Seeds one open climb into the Firestore emulator before the run. Uses the
// emulator's REST API with the "owner" token, which bypasses security rules,
// so no admin SDK is needed at the repo root.
export const E2E_CLIMB = { id: "e2e-climb", title: "Mt. E2E Smoke" };

const BASE =
  "http://127.0.0.1:8080/v1/projects/demo-e2e/databases/openclimbs/documents";

const value = (v) => {
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  return { stringValue: String(v) };
};

export default async function seed() {
  const start = new Date(Date.now() + 30 * 86400000);
  const climb = {
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
  };
  const fields = Object.fromEntries(Object.entries(climb).map(([k, v]) => [k, value(v)]));
  const res = await fetch(`${BASE}/climbs/${E2E_CLIMB.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Seeding the emulator failed: ${res.status} ${await res.text()}`);
}
