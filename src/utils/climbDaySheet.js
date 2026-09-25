import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";
import { getOutstanding } from "@/utils/registrationFees";

// The climb-day sheet: everything leads need on the trail, printable for
// when there's no signal. Everyone registered is listed — leads tick who is
// actually present on site — ordered confirmed, pending, waitlisted,
// cancelled, each alphabetically. Waitlisted and cancelled rows are flagged
// and kept out of the money and headcount totals: they aren't expected, but
// a lead can still spot someone who turns up anyway.
const STATUS_ORDER = { confirmed: 0, pending: 1, waitlisted: 2, cancelled: 3 };
const EXPECTED = ["confirmed", "pending"];

export function buildClimbDaySheet(regs = [], climb = {}, serviceGroups = {}) {
  const listed = regs
    .filter((r) => r.status in STATUS_ORDER)
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        String(a.name || "").localeCompare(String(b.name || "")),
    );

  const rows = listed.map((r) => {
    const expectedOnTrail = EXPECTED.includes(r.status);
    const missingDocs = REQUIRED_DOC_TYPES.filter(
      (d) => climb?.[d.requiresField] && !r[d.uploadField],
    ).map((d) => d.label);
    const pledge = r.donation;
    return {
      id: r.id,
      name: r.name || "(no name)",
      status: r.status,
      expected: expectedOnTrail,
      attended: !!r.attended,
      // Turned up without a confirmed slot — leads need to sort it out.
      presentNotConfirmed: !!r.attended && r.status !== "confirmed",
      pending: r.status === "pending",
      memberType: r.memberType === "member" ? "Member" : r.memberType ? "Joiner" : "",
      mobile: r.mobile || "",
      emergency: r.emergencyContact?.name
        ? {
            name: r.emergencyContact.name,
            relationship: r.emergencyContact.relationship || "",
            mobile: r.emergencyContact.mobile || "",
          }
        : null,
      medical: r.medicalConditions?.trim() || "",
      waiverSigned: !!r.waiverSigned,
      missingDocs,
      // Not chased for someone who isn't coming.
      balanceDue: expectedOnTrail ? getOutstanding(r, climb, serviceGroups) : 0,
      // Only what leads collect by hand is theirs to track on the day; a
      // with-fees pledge is already inside the balance above.
      cashOnTheDay:
        expectedOnTrail && pledge && !pledge.payWithFees
          ? Number(pledge.cashPledge) || 0
          : 0,
      items: expectedOnTrail
        ? [
            ...(pledge?.itemPledges || []).map((i) => `${i.qty} ${i.name}`),
            ...(pledge?.inKind ? [pledge.inKind] : []),
          ].join(", ")
        : "",
    };
  });

  const onTrail = rows.filter((r) => r.expected);
  const totals = {
    confirmed: rows.filter((r) => r.status === "confirmed").length,
    pending: rows.filter((r) => r.status === "pending").length,
    waitlisted: rows.filter((r) => r.status === "waitlisted").length,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
    present: rows.filter((r) => r.attended).length,
    expectedPresent: onTrail.filter((r) => r.attended).length,
    expectedCount: onTrail.length,
    presentNotConfirmed: rows.filter((r) => r.presentNotConfirmed).length,
    balanceDue: rows.reduce((s, r) => s + r.balanceDue, 0),
    owing: rows.filter((r) => r.balanceDue > 0).length,
    cashOnTheDay: rows.reduce((s, r) => s + r.cashOnTheDay, 0),
    itemDonors: rows.filter((r) => r.items).length,
    unsignedWaivers: onTrail.filter((r) => !r.waiverSigned).length,
    withMedical: onTrail.filter((r) => r.medical && !/^(none|n\/?a|no)\.?$/i.test(r.medical)).length,
  };
  return { rows, totals };
}

// The Firestore patch for ticking or unticking someone present. Being there
// also settles any no-show mark.
export function buildAttendancePatch(present, markedBy, timestamp) {
  return present
    ? {
        attended: true,
        attendedMarkedBy: markedBy,
        attendedMarkedAt: timestamp,
        noShow: false,
        noShowMarkedBy: null,
        noShowMarkedAt: null,
      }
    : { attended: false, attendedMarkedBy: null, attendedMarkedAt: null };
}
