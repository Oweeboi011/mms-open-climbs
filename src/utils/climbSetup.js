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

// `officerEmails` is climbInternal/{id}.officerEmails, index-aligned with
// climb.officers (emails are kept off the public climb doc). Omit it when it
// isn't loaded and the check is skipped.
export function getSetupGaps(climb = {}, climbPrivate = {}, officerEmails) {
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
  if (climb.officers?.length && Array.isArray(officerEmails)) {
    const noEmail = climb.officers.filter(
      (o, i) => !String(o.email || officerEmails[i]?.email || "").includes("@"),
    );
    if (noEmail.length) {
      gaps.push(
        `Add an email for ${noEmail.map((o) => o.name || "an officer").join(", ")} — ` +
          "officers without one get no registration or payment emails.",
      );
    }
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
