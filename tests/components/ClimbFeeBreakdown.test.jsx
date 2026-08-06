import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ClimbFeeBreakdown from "@/components/ClimbFeeBreakdown";

const climb = {
  fees: [
    { label: "Registration Fee", amount: "500", optional: false },
    { label: "Guide Fee", amount: "700", optional: false },
    { label: "Transportation Fee", amount: "300", optional: true },
    { label: "Guest Fee", amount: "450", optional: true, isGuestFee: true },
  ],
};

describe("ClimbFeeBreakdown", () => {
  it("lists every fee item", () => {
    render(<ClimbFeeBreakdown climb={climb} />);
    ["Registration Fee", "Guide Fee", "Transportation Fee", "Guest Fee"].forEach(
      (label) => expect(screen.getByText(label)).toBeInTheDocument(),
    );
  });

  it("totals required fees only, excluding optional and guest fees", () => {
    render(<ClimbFeeBreakdown climb={climb} />);
    expect(screen.getByText("₱1,200")).toBeInTheDocument();
  });

  it("labels the optional and joiner-only sections", () => {
    render(<ClimbFeeBreakdown climb={climb} />);
    expect(screen.getByText(/Optional — only if availed/)).toBeInTheDocument();
    expect(screen.getByText("Joiners only")).toBeInTheDocument();
  });

  it("shows TBA instead of a total when no required amount is set", () => {
    render(
      <ClimbFeeBreakdown
        climb={{ fees: [{ label: "Guide Fee", amount: "TBA" }] }}
      />,
    );
    expect(screen.getAllByText("TBA").length).toBeGreaterThan(0);
  });

  it("handles a climb with no fees", () => {
    render(<ClimbFeeBreakdown climb={{}} />);
    expect(screen.getByText(/No fees set for this climb/)).toBeInTheDocument();
  });
});
