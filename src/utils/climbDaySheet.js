import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";
import { getOutstanding } from "@/utils/registrationFees";

// The climb-day sheet: everything leads need on the trail, one row per
// person expected to show up, printable for when there's no signal.
// Confirmed first, then pending (not yet confirmed but holding a seat), each
// alphabetically. Waitlisted and cancelled registrations aren't on it.
const STATUS_ORDER = { confirmed: 0, pending: 1 };

export function buildClimbDaySheet(regs = [], climb = {}, serviceGroups = {}) {
  const expected = regs
    .filter((r) => r.status in STATUS_ORDER)
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        String(a.name || "").localeCompare(String(b.name || "")),
    );

  const rows = expected.map((r) => {
    const missingDocs = REQUIRED_DOC_TYPES.filter(
      (d) => climb?.[d.requiresField] && !r[d.uploadField],
    ).map((d) => d.label);
    const pledge = r.donation;
    return {
      id: r.id,
      name: r.name || "(no name)",
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
      balanceDue: getOutstanding(r, climb, serviceGroups),
      // Only what leads collect by hand is theirs to track on the day; a
      // with-fees pledge is already inside the balance above.
      cashOnTheDay:
        pledge && !pledge.payWithFees ? Number(pledge.cashPledge) || 0 : 0,
      items: pledge?.inKind || "",
    };
  });

  const totals = {
    confirmed: rows.filter((r) => !r.pending).length,
    pending: rows.filter((r) => r.pending).length,
    balanceDue: rows.reduce((s, r) => s + r.balanceDue, 0),
    owing: rows.filter((r) => r.balanceDue > 0).length,
    cashOnTheDay: rows.reduce((s, r) => s + r.cashOnTheDay, 0),
    itemDonors: rows.filter((r) => r.items).length,
    unsignedWaivers: rows.filter((r) => !r.waiverSigned).length,
    withMedical: rows.filter((r) => r.medical && !/^(none|n\/?a|no)\.?$/i.test(r.medical)).length,
  };
  return { rows, totals };
}
