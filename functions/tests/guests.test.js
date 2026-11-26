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
