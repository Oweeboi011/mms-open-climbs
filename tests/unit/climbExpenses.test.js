import { describe, it, expect } from "vitest";
import { sumExpenses, getNetFunds } from "@/utils/climbExpenses";

describe("sumExpenses", () => {
  it("totals amounts across items", () => {
    expect(
      sumExpenses([{ amount: 500 }, { amount: 1200 }, { amount: 300 }]),
    ).toBe(2000);
  });

  it("treats missing/invalid amounts as zero", () => {
    expect(sumExpenses([{ amount: "" }, { amount: null }, { amount: 100 }])).toBe(
      100,
    );
  });

  it("returns 0 for an empty or missing list", () => {
    expect(sumExpenses([])).toBe(0);
    expect(sumExpenses(undefined)).toBe(0);
  });
});

describe("getNetFunds", () => {
  it("subtracts total expenses from verified collections", () => {
    expect(getNetFunds(5000, [{ amount: 1200 }, { amount: 300 }])).toBe(3500);
  });

  it("can go negative when expenses exceed what's been verified", () => {
    expect(getNetFunds(500, [{ amount: 1200 }])).toBe(-700);
  });
});
