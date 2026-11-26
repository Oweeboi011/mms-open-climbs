import { describe, expect, it } from "vitest";
import { getExpectedTotal, getFeeItems, getSelfPaidItems } from "@/utils/registrationFees";
import { groupByAccommodation } from "@/utils/climbers";

const climb = {
  fees: [
    { label: "Environment Fee", optional: false, amount: "100" },
    { label: "Accomodation (Tent)", optional: true, amount: "300" },
  ],
};
const reg = {
  id: "1",
  name: "Ana",
  status: "confirmed",
  memberType: "member",
  feeBreakdown: [{ label: "Accomodation (Tent)", selected: true }],
  selfPaidFees: ["Accomodation (Tent)"],
};

describe("fees the party pays directly", () => {
  it("are not owed to the club", () => {
    expect(getExpectedTotal(reg, climb)).toBe(100);
    expect(getExpectedTotal({ ...reg, selfPaidFees: [] }, climb)).toBe(400);
  });
  it("are reported separately and kept for lists of who takes part", () => {
    expect(getSelfPaidItems(reg, climb).map((i) => i.label)).toEqual(["Accomodation (Tent)"]);
    expect(getFeeItems(reg, climb, {}, { includeSelfPaid: true })).toHaveLength(2);
  });
  it("still put the person in the accommodation list", () => {
    const { options } = groupByAccommodation([reg], climb);
    expect(options[0].regs.map((r) => r.name)).toEqual(["Ana"]);
  });
});
