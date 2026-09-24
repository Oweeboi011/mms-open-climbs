// Outreach / community donation drives attached to a climb.
//
// A climb can collect donations for a beneficiary (a school, a community on
// the trail). Members *pledge* — cash they'll hand to the leads on climb day
// and/or items they'll carry up — and leads *record* what actually arrived.
// None of it touches fees, payments, balances or the club's net funds: the
// money goes to the beneficiary, not the club.

export const MAX_CASH_PLEDGE = 1_000_000;
export const MAX_IN_KIND_LENGTH = 500;

export function isDonationDriveOn(climb) {
  return !!climb?.donationDrive?.enabled;
}

// A member's pledge as stored on the registration, or null when they
// pledged nothing.
export function normalizePledge({ cashPledge, inKind } = {}) {
  const cash = Number(String(cashPledge ?? "").replace(/[^0-9.]/g, ""));
  const items = String(inKind ?? "").trim().slice(0, MAX_IN_KIND_LENGTH);
  const cashValue = cash > 0 ? Math.min(Math.round(cash * 100) / 100, MAX_CASH_PLEDGE) : null;
  if (!cashValue && !items) return null;
  return { cashPledge: cashValue, inKind: items };
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
export function summarizeDonations(regs = []) {
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
    if (got) {
      summary.donors++;
      summary.receivedCash += Number(got.cash) || 0;
      if (got.items) summary.itemDonations++;
    }
  }
  return summary;
}
