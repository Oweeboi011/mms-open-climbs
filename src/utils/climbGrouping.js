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
