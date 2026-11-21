"use strict";

const { regHeadcount } = require("../src/shared/guests");

describe("regHeadcount", () => {
  it("is the member plus their guests", () => {
    expect(regHeadcount({})).toBe(1);
    expect(regHeadcount({ guests: [{}, {}] })).toBe(3);
    expect(regHeadcount({ guests: "bad" })).toBe(1);
  });
});
