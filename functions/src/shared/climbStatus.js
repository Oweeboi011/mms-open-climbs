"use strict";

// A cancelled climb is over as far as its registrants are concerned — chasing
// them for payment, nagging for documents, counting down to the trek, or
// thanking them for a climb that never happened are all wrong. A postponed
// one is still going ahead, so payment and document reminders stand; only the
// date-driven messages are suppressed, since the old dates no longer mean
// anything.
const isClimbCancelled = (climb) =>
  climb?.status === "cancelled" || climb?.cancellationStatus === "cancelled";
const isClimbPostponed = (climb) => climb?.cancellationStatus === "postponed";
// Over once marked completed or once its last day (endDate, else startDate)
// has fully passed in Manila. Document nags and the officers' daily summary
// stop then; members are still reminded of any balance they owe.
const isClimbOver = (climb, now = Date.now()) => {
  if (climb?.status === "completed") return true;
  const last = (climb?.endDate ?? climb?.startDate)?.toDate?.();
  return !!last && last.getTime() + 86400000 < now;
};

module.exports = { isClimbCancelled, isClimbPostponed, isClimbOver };
