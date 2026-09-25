import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";

// What an admin needs to know about a climb's set-up at a glance, and what
// is still missing before members can register, pay and turn up prepared.
// Each gap is phrased as the thing to do, and only flags what the app itself
// relies on (a GCash number to pay to, officers to notify, and so on).

// The next pre-climb meeting on or after today, if any ("YYYY-MM-DD" dates).
export function nextMeeting(meetings = [], now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return (
    [...meetings]
      .filter((m) => m?.date && m.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null
  );
}

export function getSetupGaps(climb = {}, climbPrivate = {}) {
  const gaps = [];
  if (!climb.startDate) gaps.push("Set the climb dates.");
  if (!Number(climb.maxParticipants)) {
    gaps.push("Set a participant limit — without one there's no waitlist.");
  }
  if (!climb.fees?.length) gaps.push("Add the fee schedule.");
  if (climb.fees?.length && !climb.gcashNumber && !climb.gcashQrUrl) {
    gaps.push("Add GCash payment details so members know where to pay.");
  }
  if (!climb.officers?.length) {
    gaps.push("Assign climb officers — they're who gets registration emails.");
  }
  if (climb.fees?.length && !climb.paymentDueDate) {
    gaps.push("Set a payment due date.");
  }
  if (!climb.cancellationPolicy?.trim()) {
    gaps.push("Write the cancellation & refund policy.");
  }
  if (!(climbPrivate?.preClimbMeetings || []).length) {
    gaps.push("Schedule the pre-climb meeting.");
  }
  if (climb.donationDrive?.enabled && !climb.donationDrive.beneficiary?.trim()) {
    gaps.push("Name the donation drive's beneficiary.");
  }
  return gaps;
}

export function requiredDocLabels(climb = {}) {
  return REQUIRED_DOC_TYPES.filter((d) => climb[d.requiresField]).map((d) => d.label);
}
