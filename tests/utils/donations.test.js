import { describe, it, expect } from "vitest";
import {
  buildDonationCollection,
  getNeededItems,
  publicDonationTotals,
  stillNeededFromTotals,
  getDonationFeeItem,
  getDonationPaidWithFees,
  isDonationDriveOn,
  normalizePledge,
  normalizeReceived,
  summarizeDonations,
} from "@/utils/donations";

describe("isDonationDriveOn", () => {
  it("is on only when the climb enabled a drive", () => {
    expect(isDonationDriveOn({ donationDrive: { enabled: true } })).toBe(true);
    expect(isDonationDriveOn({ donationDrive: { enabled: false } })).toBe(false);
    expect(isDonationDriveOn({})).toBe(false);
    expect(isDonationDriveOn(undefined)).toBe(false);
  });
});

describe("normalizePledge", () => {
  it("keeps a cash amount and trimmed items", () => {
    expect(normalizePledge({ cashPledge: "500", inKind: "  notebooks " })).toEqual({
      cashPledge: 500,
      inKind: "notebooks",
      payWithFees: true,
    });
  });
  it("remembers a cash pledge to hand over on the day", () => {
    expect(
      normalizePledge({ cashPledge: "500", inKind: "", payWithFees: false }).payWithFees,
    ).toBe(false);
  });
  it("is null when nothing was pledged, so an empty form withdraws", () => {
    expect(normalizePledge({ cashPledge: "", inKind: "  " })).toBeNull();
    expect(normalizePledge({ cashPledge: "0", inKind: "" })).toBeNull();
  });
  it("stores null cash for an items-only pledge", () => {
    expect(normalizePledge({ cashPledge: "", inKind: "pencils" })).toEqual({
      cashPledge: null,
      inKind: "pencils",
      payWithFees: false,
    });
  });
  it("caps runaway input to what the rules accept", () => {
    const p = normalizePledge({ cashPledge: "99999999", inKind: "x".repeat(900) });
    expect(p.cashPledge).toBe(1_000_000);
    expect(p.inKind).toHaveLength(500);
  });
});

describe("normalizeReceived", () => {
  it("records who received it and when", () => {
    expect(normalizeReceived({ cash: "250", items: "rice" }, "Lead Ana", "TS")).toEqual({
      cash: 250,
      items: "rice",
      receivedBy: "Lead Ana",
      receivedAt: "TS",
    });
  });
  it("is null when nothing was received (clears the record)", () => {
    expect(normalizeReceived({ cash: "", items: "" }, "Lead", "TS")).toBeNull();
  });
});

describe("summarizeDonations", () => {
  it("totals pledges from active registrations and everything received", () => {
    const regs = [
      { status: "confirmed", donation: { cashPledge: 500, inKind: "books" }, donationReceived: { cash: 400, items: "books" } },
      { status: "pending", donation: { cashPledge: 200, inKind: "" } },
      { status: "cancelled", donation: { cashPledge: 1000, inKind: "" } },
      { status: "confirmed", donationReceived: { cash: 100, items: "" } },
      { status: "confirmed" },
    ];
    expect(summarizeDonations(regs)).toEqual({
      pledgedCash: 700,
      receivedCash: 500,
      pledgers: 2,
      donors: 2,
      itemPledges: 1,
      itemDonations: 1,
    });
  });
});

describe("donations paid with fees", () => {
  const climb = { donationDrive: { enabled: true, beneficiary: "Tanglag School" } };
  const reg = { donation: { cashPledge: 300, inKind: "", payWithFees: true } };

  it("adds a donation line to what the member owes", () => {
    expect(getDonationFeeItem(reg, climb)).toEqual({
      label: "Donation — Tanglag School",
      amount: 300,
      isDonation: true,
    });
  });

  it("adds nothing for an on-the-day pledge or a climb without a drive", () => {
    expect(getDonationFeeItem({ donation: { ...reg.donation, payWithFees: false } }, climb)).toBeNull();
    expect(getDonationFeeItem(reg, {})).toBeNull();
  });

  it("counts as donated only what was paid beyond the fees, up to the pledge", () => {
    // fees 1000: a 1100 payment is 100 donated; 1500 caps at the 300 pledge
    expect(getDonationPaidWithFees(reg, 1000, 800)).toBe(0);
    expect(getDonationPaidWithFees(reg, 1000, 1100)).toBe(100);
    expect(getDonationPaidWithFees(reg, 1000, 1500)).toBe(300);
    expect(getDonationPaidWithFees({ donation: { cashPledge: 300 } }, 1000, 1500)).toBe(0);
  });
});

describe("donation collection process", () => {
  const climb = {
    donationDrive: {
      enabled: true,
      beneficiary: "School",
      cashGoal: 1000,
      neededItems: [
        { name: "Notebooks", target: 60, unit: "pcs" },
        { name: "Rice", target: 30, unit: "kg" },
      ],
    },
  };
  const regs = [
    { id: "a", name: "Ana", status: "confirmed", donation: { cashPledge: 300, payWithFees: false, itemPledges: [{ name: "Notebooks", qty: 20 }] } },
    { id: "b", name: "Ben", status: "pending", donation: { cashPledge: 200, payWithFees: true, itemPledges: [{ name: "Rice", qty: 10 }] },
      donationReceived: { cash: 0, items: "", itemQuantities: [{ name: "Rice", qty: 12 }], receivedBy: "Lead" } },
    { id: "c", name: "Cara", status: "cancelled", donation: { cashPledge: 999, payWithFees: false, itemPledges: [{ name: "Notebooks", qty: 50 }] } },
  ];
  const paidWithFees = (r) => (r.id === "b" ? 200 : 0);
  const c = buildDonationCollection(regs, climb, paidWithFees);

  it("tracks each needed item: pledged, received, still needed, unpledged", () => {
    expect(c.items).toEqual([
      { name: "Notebooks", target: 60, unit: "pcs", pledged: 20, received: 0, stillNeeded: 60, unpledged: 40 },
      { name: "Rice", target: 30, unit: "kg", pledged: 10, received: 12, stillNeeded: 18, unpledged: 18 },
    ]);
  });

  it("splits cash into with-fees and on-the-day, and what leads still collect", () => {
    expect(c.cash).toEqual({
      goal: 1000,
      pledgedWithFees: 200,
      pledgedOnDay: 300,
      receivedViaGcash: 200,
      receivedOnDay: 0,
      received: 200,
      toCollectOnDay: 300,
      stillNeeded: 800,
    });
  });

  it("lists who to collect from, uncollected first, cancelled pledges excluded", () => {
    expect(c.people.map((p) => [p.reg.id, p.collected])).toEqual([["a", false], ["b", true]]);
  });

  it("publishes totals without naming anyone", () => {
    const pub = publicDonationTotals(c);
    expect(JSON.stringify(pub)).not.toMatch(/Ana|Ben/);
    expect(pub.items[1]).toEqual({ name: "Rice", unit: "kg", target: 30, pledged: 10, received: 12 });
    expect(stillNeededFromTotals({ donationTotals: pub })).toEqual({ Notebooks: 40, Rice: 18 });
  });

  it("reads old free-text suggestions as items with no target", () => {
    expect(getNeededItems({ suggestedItems: "Pencils" + String.fromCharCode(10, 10) + "Crayons" })).toEqual([
      { name: "Pencils", target: 0, unit: "" },
      { name: "Crayons", target: 0, unit: "" },
    ]);
  });

  it("pledges only positive quantities of items the drive asks for", () => {
    expect(
      normalizePledge({ itemQty: { Notebooks: "5", Rice: "0", Bogus: "9" } }, getNeededItems(climb.donationDrive)),
    ).toEqual({ cashPledge: null, inKind: "", payWithFees: false, itemPledges: [{ name: "Notebooks", qty: 5 }] });
  });
});

