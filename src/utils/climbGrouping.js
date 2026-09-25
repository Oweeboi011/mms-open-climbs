// Splits a list of climbs into what's still ahead and what's done, so the
// admin pages that list climbs all draw the same line in the same place.
//
// A climb counts as completed once an admin marks it so, or once its whole
// event day has elapsed — endDate when set, otherwise the start date. Dates
// may be a Firestore Timestamp or a plain "YYYY-MM-DD" string (from the admin
// date picker), so both are handled.

export function climbEndOf(climb) {
  const raw = climb?.endDate ?? climb?.startDate;
  const d = raw?.toDate?.() ?? (raw ? new Date(raw) : null);
  if (!d || isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isClimbCompleted(climb, now = new Date()) {
  if (climb?.status === "completed") return true;
  const end = climbEndOf(climb);
  return !!end && end < now;
}

// Soonest first for what's still ahead; most recent first for what's done.
// Climbs with no usable date sort last among the upcoming.
export function groupClimbsByCompletion(climbs = [], now = new Date()) {
  const upcoming = [];
  const completed = [];
  for (const climb of climbs) {
    (isClimbCompleted(climb, now) ? completed : upcoming).push(climb);
  }
  const byEnd = (a, b) =>
    (climbEndOf(a)?.getTime() ?? Infinity) -
    (climbEndOf(b)?.getTime() ?? Infinity);
  upcoming.sort(byEnd);
  completed.sort((a, b) => byEnd(b, a));
  return { upcoming, completed };
}

const MONTH_ABBRS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

function climbStartOf(climb) {
  const raw = climb?.startDate;
  const d = raw?.toDate?.() ?? (raw ? new Date(raw) : null);
  return d && !isNaN(d.getTime()) ? d : null;
}

// Schedule sections key on the start date's year and month, so climbs from
// any month of any year land in their own section. Climbs without a usable
// start date fall back to the legacy `month` field ("jul") with no year.
export function climbMonthKey(climb) {
  const d = climbStartOf(climb);
  if (d) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const idx = MONTH_ABBRS.indexOf(climb?.month);
  return idx >= 0 ? `0000-${String(idx + 1).padStart(2, "0")}` : "0000-00";
}

export function monthKeyLabel(key, { withYear = true } = {}) {
  const [year, month] = key.split("-").map(Number);
  if (!month) return "Date to be announced";
  const name = new Date(2000, month - 1, 1).toLocaleString("en-US", { month: "long" });
  return withYear && year ? `${name} ${year}` : name;
}

// [{ key, climbs }] in calendar order, each section's climbs soonest first.
export function groupClimbsByMonth(climbs = []) {
  const sections = new Map();
  for (const climb of climbs) {
    const key = climbMonthKey(climb);
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key).push(climb);
  }
  const byStart = (a, b) =>
    (climbStartOf(a)?.getTime() ?? 0) - (climbStartOf(b)?.getTime() ?? 0);
  return [...sections.keys()]
    .sort((a, b) => (a === "0000-00") - (b === "0000-00") || a.localeCompare(b))
    .map((key) => ({ key, climbs: sections.get(key).sort(byStart) }));
}

// Distinct season years on the schedule, oldest first ("0000" = undated).
export function seasonYears(climbs = []) {
  return [...new Set(climbs.map((c) => climbMonthKey(c).slice(0, 4)))]
    .filter((y) => y !== "0000")
    .sort();
}

export function defaultSeason(climbs = [], years = seasonYears(climbs), now = new Date()) {
  const next = climbs
    .filter((c) => !isClimbCompleted(c, now) && climbStartOf(c))
    .sort((a, b) => climbStartOf(a) - climbStartOf(b))[0];
  return next ? String(climbStartOf(next).getFullYear()) : years[years.length - 1];
}
