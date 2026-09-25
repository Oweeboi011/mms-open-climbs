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
export const MAX_ITEM_QTY = 10_000;

const round2 = (n) => Math.round(n * 100) / 100;
const cleanQty = (q) => {
  const n = Math.floor(Number(String(q ?? "").replace(/[^0-9.]/g, "")) || 0);
  return Math.min(Math.max(n, 0), MAX_ITEM_QTY);
};

// What the drive is collecting: `neededItems` [{ name, target, unit }] with a
// target quantity each. Drives set up before targets existed only have the
// free-text `suggestedItems` (one per line) - those read as items with no
// target, so the rest of the process still works.
export function getNeededItems(drive = {}) {
  if (Array.isArray(drive.neededItems) && drive.neededItems.length) {
    return drive.neededItems
      .filter((i) => i?.name?.trim())
      .map((i) => ({ name: i.name.trim(), target: cleanQty(i.target), unit: i.unit?.trim() || "" }));
  }
  return String(drive.suggestedItems || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name, target: 0, unit: "" }));
}

// { itemName: qty } from a form, as [{ name, qty }] with only positive
// quantities, limited to items the drive actually asks for.
export function normalizeItemQuantities(byName = {}, neededItems = []) {
  return neededItems
    .map((i) => ({ name: i.name, qty: cleanQty(byName?.[i.name]) }))
    .filter((i) => i.qty > 0);
}

// [{ name, qty }] back to { itemName: qty } for editing forms.
export function itemQtyMap(list = []) {
  return Object.fromEntries((list || []).map((i) => [i.name, i.qty]));
}

export function isDonationDriveOn(climb) {
  return !!climb?.donationDrive?.enabled;
}

// A member's pledge as stored on the registration, or null when they
// pledged nothing.
// `itemQty` is { itemName: qty } for the drive's needed items; `inKind` is
// free text for anything else.
export function normalizePledge(
  { cashPledge, inKind, payWithFees = true, itemQty } = {},
  neededItems = [],
) {
  const cash = Number(String(cashPledge ?? "").replace(/[^0-9.]/g, ""));
  const items = String(inKind ?? "").trim().slice(0, MAX_IN_KIND_LENGTH);
  const cashValue = cash > 0 ? Math.min(Math.round(cash * 100) / 100, MAX_CASH_PLEDGE) : null;
  const itemPledges = normalizeItemQuantities(itemQty, neededItems);
  if (!cashValue && !items && itemPledges.length === 0) return null;
  return {
    cashPledge: cashValue,
    inKind: items,
    payWithFees: !!cashValue && !!payWithFees,
    ...(itemPledges.length ? { itemPledges } : {}),
  };
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
export function normalizeReceived(
  { cash, items, itemQty } = {},
  receivedBy,
  receivedAt,
  neededItems = [],
) {
  const cashValue = Math.max(0, Number(String(cash ?? "").replace(/[^0-9.]/g, "")) || 0);
  const itemText = String(items ?? "").trim().slice(0, MAX_IN_KIND_LENGTH);
  const itemQuantities = normalizeItemQuantities(itemQty, neededItems);
  if (!cashValue && !itemText && itemQuantities.length === 0) return null;
  return {
    cash: round2(cashValue),
    items: itemText,
    ...(itemQuantities.length ? { itemQuantities } : {}),
    receivedBy,
    receivedAt,
  };
}

const qtyOf = (list, name) =>
  (list || []).filter((i) => i.name === name).reduce((s, i) => s + (Number(i.qty) || 0), 0);

// The whole collection picture for one drive: per needed item how many are
// pledged, received and still needed; the cash goal against pledges and
// receipts (via GCash with fees, or handed over on the day); and, per
// person, what leads should collect from them on the day.
export function buildDonationCollection(regs = [], climb = {}, paidWithFees = () => 0) {
  const drive = climb.donationDrive || {};
  const needed = getNeededItems(drive);
  const active = regs.filter((r) => r.status !== "cancelled");

  const items = needed.map((i) => {
    const pledged = active.reduce((s, r) => s + qtyOf(r.donation?.itemPledges, i.name), 0);
    const received = regs.reduce(
      (s, r) => s + qtyOf(r.donationReceived?.itemQuantities, i.name),
      0,
    );
    return {
      ...i,
      pledged,
      received,
      // How many more have to arrive to hit the target.
      stillNeeded: i.target ? Math.max(0, i.target - received) : null,
      // How many nobody has even pledged yet - what to ask members for.
      unpledged: i.target ? Math.max(0, i.target - Math.max(pledged, received)) : null,
    };
  });

  let pledgedWithFees = 0;
  let pledgedOnDay = 0;
  let receivedViaGcash = 0;
  let receivedOnDay = 0;
  const people = [];
  for (const r of regs) {
    const pledge = r.donation;
    const got = r.donationReceived;
    const viaGcash = paidWithFees(r) || 0;
    receivedViaGcash += viaGcash;
    receivedOnDay += Number(got?.cash) || 0;
    const live = r.status !== "cancelled";
    if (live && pledge?.cashPledge) {
      if (pledge.payWithFees) pledgedWithFees += Number(pledge.cashPledge) || 0;
      else pledgedOnDay += Number(pledge.cashPledge) || 0;
    }
    if (!(live && pledge) && !got && viaGcash <= 0) continue;
    people.push({
      reg: r,
      cashOnDay: live && pledge && !pledge.payWithFees ? Number(pledge.cashPledge) || 0 : 0,
      cashWithFees: live && pledge?.payWithFees ? Number(pledge.cashPledge) || 0 : 0,
      viaGcash,
      itemPledges: live ? pledge?.itemPledges || [] : [],
      other: live ? pledge?.inKind || "" : "",
      received: got || null,
      collected: !!got,
    });
  }
  people.sort(
    (a, b) =>
      Number(a.collected) - Number(b.collected) ||
      String(a.reg.name || "").localeCompare(String(b.reg.name || "")),
  );

  const goal = Number(drive.cashGoal) || 0;
  const cash = {
    goal,
    pledgedWithFees: round2(pledgedWithFees),
    pledgedOnDay: round2(pledgedOnDay),
    receivedViaGcash: round2(receivedViaGcash),
    receivedOnDay: round2(receivedOnDay),
    received: round2(receivedViaGcash + receivedOnDay),
    toCollectOnDay: round2(
      people.filter((p) => !p.collected).reduce((s, p) => s + p.cashOnDay, 0),
    ),
    stillNeeded: goal ? round2(Math.max(0, goal - receivedViaGcash - receivedOnDay)) : null,
  };
  return { needed, items, cash, people };
}

// { itemName: how many nobody has pledged yet } from the public totals on
// the climb doc, for nudging members toward what's still missing.
export function stillNeededFromTotals(climb) {
  const items = climb?.donationTotals?.items;
  if (!Array.isArray(items)) return {};
  return Object.fromEntries(
    items
      .filter((i) => i.target > 0)
      .map((i) => [i.name, Math.max(0, i.target - Math.max(i.pledged || 0, i.received || 0))]),
  );
}

// What the event page may show publicly: totals only, never who gave what.
export function publicDonationTotals(collection) {
  return {
    receivedCash: collection.cash.received,
    cashGoal: collection.cash.goal,
    donors: collection.people.filter((p) => p.collected || p.viaGcash > 0).length,
    itemDonations: collection.people.filter(
      (p) => p.received?.items || p.received?.itemQuantities?.length,
    ).length,
    items: collection.items.map((i) => ({
      name: i.name,
      unit: i.unit,
      target: i.target,
      pledged: i.pledged,
      received: i.received,
    })),
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
