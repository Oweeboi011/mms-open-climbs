import { doc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { logAuditEvent } from "@/utils/auditLog";
import { getCountedPaid, getExpectedTotal } from "@/utils/registrationFees";
import {
  buildDonationCollection,
  getDonationFeeItem,
  getDonationPaidWithFees,
  getNeededItems,
  normalizeReceived,
  publicDonationTotals,
} from "@/utils/donations";

// The part of a member's GCash payments that is their donation (sent with
// their fees) rather than the club's money. Lives here, not in donations.js,
// because it needs the fee maths (which itself imports donations.js).
export function makePaidWithFees(climb, serviceGroups = {}) {
  return (reg) =>
    getDonationPaidWithFees(
      reg,
      getExpectedTotal(reg, climb, serviceGroups) - (getDonationFeeItem(reg, climb)?.amount || 0),
      getCountedPaid(reg),
    );
}

// Leads record what a person actually handed over (cash, needed items by
// quantity, anything else). Also republishes the drive's public totals on
// the climb doc and audit-logs who received it. `regs` is every
// registration on the climb, so the totals include this change.
export async function recordDonationReceived({
  reg,
  received,
  regs,
  climb,
  serviceGroups,
  currentUser,
}) {
  const actor = currentUser?.displayName || currentUser?.email || "admin";
  const needed = getNeededItems(climb.donationDrive);
  const donationReceived = normalizeReceived(received, actor, Timestamp.now(), needed);
  await updateDoc(doc(db, "registrations", reg.id), {
    donationReceived,
    updatedAt: serverTimestamp(),
  });
  const next = regs.map((r) => (r.id === reg.id ? { ...r, donationReceived } : r));
  await publishDonationTotals(climb, next, serviceGroups);

  const itemsText = (donationReceived?.itemQuantities || [])
    .map((i) => `${i.qty} ${i.name}`)
    .concat(donationReceived?.items ? [donationReceived.items] : [])
    .join(", ");
  logAuditEvent({
    actorUid: currentUser?.uid,
    actorName: actor,
    action: donationReceived ? "donation_recorded" : "donation_cleared",
    targetType: "registration",
    targetId: reg.id,
    targetLabel: reg.name || reg.id,
    details: donationReceived
      ? `Received ₱${donationReceived.cash.toLocaleString("en-PH")}` +
        `${itemsText ? ` + ${itemsText}` : ""}` +
        ` for ${climb.donationDrive?.beneficiary || climb.title || "outreach"}`
      : `Cleared donation record for ${climb.title || "climb"}`,
  });
  return next;
}

export async function publishDonationTotals(climb, regs, serviceGroups) {
  const collection = buildDonationCollection(regs, climb, makePaidWithFees(climb, serviceGroups));
  await updateDoc(doc(db, "climbs", climb.id), {
    donationTotals: publicDonationTotals(collection),
  });
}
