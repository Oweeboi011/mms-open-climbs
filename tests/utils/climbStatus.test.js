import { describe, it, expect } from "vitest";
import { getEffectiveStatus } from "@/utils/climbStatus";

describe("getEffectiveStatus", () => {
  it("uses the climb's own status", () => {
    expect(getEffectiveStatus({ status: "open" })).toBe("open");
    expect(getEffectiveStatus({ status: "cancelled" })).toBe("cancelled");
  });

  it("defaults to draft when status is missing", () => {
    expect(getEffectiveStatus({})).toBe("draft");
    expect(getEffectiveStatus(undefined)).toBe("draft");
  });

  it("reads climbs cancelled before cancellation moved onto status", () => {
    expect(
      getEffectiveStatus({ status: "closed", cancellationStatus: "cancelled" }),
    ).toBe("cancelled");
  });

  it("leaves a postponed climb on its lifecycle status", () => {
    expect(
      getEffectiveStatus({ status: "open", cancellationStatus: "postponed" }),
    ).toBe("open");
  });
});
