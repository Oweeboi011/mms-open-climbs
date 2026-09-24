import { describe, it, expect } from "vitest";
import {
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
    });
  });
  it("is null when nothing was pledged, so an empty form withdraws", () => {
    expect(normalizePledge({ cashPledge: "", inKind: "  " })).toBeNull();
    expect(normalizePledge({ cashPledge: "0", inKind: "" })).toBeNull();
  });
  it("stores null cash for an items-only pledge", () => {
    expect(normalizePledge({ cashPledge: "", inKind: "pencils" })).toEqual({
      cashPledge: null,
      inKind: "pencils",
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
