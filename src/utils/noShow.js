import { isClimbCompleted } from "@/utils/climbGrouping";

// A no-show is a confirmed registrant who didn't turn up on climb day.
// Attendance itself is taken on site; admins record the absentees here
// afterwards. It is a flag, not a status: the registration stays
// "confirmed", so payments, balances, counters and status emails are
// untouched, and marking it by mistake is a one-click undo.

// Only once the climb is over, and only for people who were expected.
export function canMarkNoShow(reg, climb, now = new Date()) {
  return reg?.status === "confirmed" && isClimbCompleted(climb, now);
}

// How many *other* climbs each member was a no-show on, keyed by userId.
// `noShowRegs` is every registration flagged noShow (a small set).
export function countPriorNoShows(noShowRegs = [], currentClimbId) {
  const counts = {};
  for (const r of noShowRegs) {
    if (!r?.noShow || !r.userId || r.climbId === currentClimbId) continue;
    counts[r.userId] = (counts[r.userId] || 0) + 1;
  }
  return counts;
}

// The Firestore patch for marking or clearing, with who and when.
export function buildNoShowPatch(noShow, markedBy, timestamp) {
  return noShow
    ? { noShow: true, noShowMarkedBy: markedBy, noShowMarkedAt: timestamp }
    : { noShow: false, noShowMarkedBy: null, noShowMarkedAt: null };
}
