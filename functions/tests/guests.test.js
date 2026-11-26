"use strict";

const { regHeadcount } = require("../src/shared/guests");

describe("regHeadcount", () => {
  it("is the member plus their guests", () => {
    expect(regHeadcount({})).toBe(1);
    expect(regHeadcount({ guests: [{}, {}] })).toBe(3);
    expect(regHeadcount({ guests: "bad" })).toBe(1);
  });
});

describe("guestOwesFee exclusions", () => {
  const { guestOwesFee } = require("../src/shared/guests");
  it("skips fees the admin took off the guest", () => {
    const fee = { label: "Mt. A - Guide Fee", optional: true };
    expect(guestOwesFee({ excludedFees: ["Mt. A - Guide Fee"] }, fee, {}, true)).toBe(false);
    expect(guestOwesFee({}, fee, {}, true)).toBe(true);
  });
});

describe("guestOwesFee guest fee", () => {
  const { guestOwesFee } = require("../src/shared/guests");
  const gf = { label: "Guest Fee", isGuestFee: true, optional: true };
  it("charges a member's guest the Guest Fee unless an admin waived it", () => {
    expect(guestOwesFee({ name: "K" }, gf, {}, false)).toBe(true);
    expect(guestOwesFee({ name: "K", excludedFees: ["Guest Fee"] }, gf, {}, false)).toBe(false);
  });
});
