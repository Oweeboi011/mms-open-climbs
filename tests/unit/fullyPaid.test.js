import { describe, it, expect } from "vitest";
import { getFullyPaid } from "@/components/admin/BalanceDueTable";

const climb = (amount = "500") => ({
  fees: [{ label: "Registration Fee", amount, optional: false }],
});
const reg = (id, name, amountPaid, extra = {}) => ({
  id,
  name,
  status: "confirmed",
  memberType: "member",
  paymentStatus: amountPaid > 0 ? "verified" : "unpaid",
  amountPaid,
  ...extra,
});

describe("getFullyPaid", () => {
  it("lists registrants who paid their fees in full or more, by name", () => {
    const rows = getFullyPaid(
      [reg("1", "Zed", 500), reg("2", "Ana", 800), reg("3", "Mia", 200)],
      climb(),
    );
    expect(rows.map((r) => r.reg.name)).toEqual(["Ana", "Zed"]);
    expect(rows[1]).toMatchObject({ expected: 500, paid: 500, amount: 500 });
  });

  it("skips cancelled registrations", () => {
    expect(getFullyPaid([reg("1", "Ana", 500, { status: "cancelled" })], climb())).toEqual([]);
  });

  it("skips anyone whose fees are still TBA, so nobody looks settled early", () => {
    expect(getFullyPaid([reg("1", "Ana", 500)], climb("TBA"))).toEqual([]);
  });

  it("doesn't count a rejected payment as paid", () => {
    expect(
      getFullyPaid([reg("1", "Ana", 500, { paymentStatus: "rejected" })], climb()),
    ).toEqual([]);
  });
});
