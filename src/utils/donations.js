// Outreach / community donation drives attached to a climb.
//
// A climb can collect donations for a beneficiary (a school, a community on
// the trail). Members *pledge* cash and/or items they'll carry up. Cash is
// either added to their GCash payment with their fees (`payWithFees`, the
// default) — it then appears as a "Donation" line on what they owe, so the
// balance, receipt and reminders all include it — or handed to the leads on
// climb day, where leads *record* what actually arrived. Either way it is the
// beneficiary's money, so it is kept out of the club's net funds.

export const MAX_CASH_PLEDGE = 1_000_000;
export const MAX_IN_KIND_LENGTH = 500;

export function isDonationDriveOn(climb) {
  return !!climb?.donationDrive?.enabled;
}

// A member's pledge as stored on the registration, or null when they
// pledged nothing.
export function normalizePledge({ cashPledge, inKind, payWithFees = true } = {}) {
  const cash = Number(String(cashPledge ?? "").replace(/[^0-9.]/g, ""));
  const items = String(inKind ?? "").trim().slice(0, MAX_IN_KIND_LENGTH);
  const cashValue = cash > 0 ? Math.min(Math.round(cash * 100) / 100, MAX_CASH_PLEDGE) : null;
  if (!cashValue && !items) return null;
  return { cashPledge: cashValue, inKind: items, payWithFees: !!cashValue && !!payWithFees };
}

// The donation line added to what a member owes when they chose to send
// their cash pledge with their GCash payment. Null otherwise.
export function getDonationFeeItem(reg, climb) {
  const pledge = reg?.donation;
  if (!isDonationDriveOn(climb) || !pledge?.payWithFees) return null;
  const amount = Number(pledge.cashPledge) || 0;
  if (amount <= 0) return null;
  return {
    label: `Donation — ${climb.donationDrive.beneficiary || "outreach"}`,
    amount,
    isDonation: true,
  };
}

// How much of a member's payments is their with-fees donation: whatever they
// paid beyond their fees, up to the pledge. Fees are settled first, so a
// part-payment is never counted as donated money the club still needs.
export function getDonationPaidWithFees(reg, feesOnlyTotal, countedPaid) {
  if (!reg?.donation?.payWithFees) return 0;
  const pledge = Number(reg.donation.cashPledge) || 0;
  return Math.max(0, Math.min(pledge, countedPaid - feesOnlyTotal));
}

// What leads recorded as received from one registrant.
export function normalizeReceived({ cash, items } = {}, receivedBy, receivedAt) {
  const cashValue = Math.max(0, Number(String(cash ?? "").replace(/[^0-9.]/g, "")) || 0);
  const itemText = String(items ?? "").trim().slice(0, MAX_IN_KIND_LENGTH);
  if (!cashValue && !itemText) return null;
  return {
    cash: Math.round(cashValue * 100) / 100,
    items: itemText,
    receivedBy,
    receivedAt,
  };
}

// Totals across a climb's registrations. Cancelled registrations' pledges
// don't count; anything actually received does, whatever the status.
// `paidWithFees(reg)` gives the donation collected through GCash (see
// getDonationPaidWithFees); it counts as received alongside what leads
// recorded on the day.
export function summarizeDonations(regs = [], paidWithFees = () => 0) {
  const summary = {
    pledgedCash: 0,
    receivedCash: 0,
    pledgers: 0,
    donors: 0,
    itemPledges: 0,
    itemDonations: 0,
  };
  for (const r of regs) {
    const pledge = r?.donation;
    if (pledge && r.status !== "cancelled") {
      summary.pledgers++;
      summary.pledgedCash += Number(pledge.cashPledge) || 0;
      if (pledge.inKind) summary.itemPledges++;
    }
    const got = r?.donationReceived;
    const viaGcash = paidWithFees(r) || 0;
    if (got || viaGcash > 0) {
      summary.donors++;
      summary.receivedCash += (Number(got?.cash) || 0) + viaGcash;
      if (got?.items) summary.itemDonations++;
    }
  }
  return summary;
}
