/**
 * Tests for the member-facing payment log — the breakdown shown on the
 * Official Receipt and in the Add Fees / Pay More prompt. What matters is
 * that each instalment keeps its own verdict, comment and receipts instead
 * of merging into one total.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PaymentLog from "@/components/PaymentLog";

const at = (iso) => ({ toDate: () => new Date(iso) });

describe("PaymentLog", () => {
  it("renders nothing when there is no payment and no empty text", () => {
    const { container } = render(<PaymentLog reg={{ id: "r1" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the empty text when one is given", () => {
    render(<PaymentLog reg={{ id: "r1" }} emptyText="Nothing paid yet." />);
    expect(screen.getByText("Nothing paid yet.")).toBeInTheDocument();
  });

  it("lists each instalment with its amount, comment and receipts", () => {
    render(
      <PaymentLog
        reg={{
          id: "r1",
          payments: [
            {
              amount: 1500,
              status: "verified",
              submittedAt: at("2026-07-01T10:00:00Z"),
              note: "downpayment",
              proofs: [{ url: "https://x/gcash1.png", fileName: "gcash1.png" }],
            },
            {
              amount: 1000,
              status: "submitted",
              submittedAt: at("2026-07-20T10:00:00Z"),
              note: "balance",
              proofs: [],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Payment 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Payment 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("₱1,500")).toBeInTheDocument();
    expect(screen.getByText("₱1,000")).toBeInTheDocument();
    expect(screen.getByText("downpayment")).toBeInTheDocument();
    expect(screen.getByText("balance")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Awaiting Review")).toBeInTheDocument();
    expect(screen.getByText("gcash1.png")).toHaveAttribute(
      "href",
      "https://x/gcash1.png",
    );
    expect(
      screen.getByText("No receipt attached to this payment."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Total submitted across 2 payments: ₱2,500/),
    ).toBeInTheDocument();
  });

  it("explains that a rejected instalment no longer counts", () => {
    render(
      <PaymentLog
        reg={{
          id: "r1",
          payments: [
            { amount: 1500, status: "verified", proofs: [] },
            { amount: 800, status: "rejected", proofs: [] },
          ],
        }}
      />,
    );
    expect(
      screen.getByText(/₱1,500 counts toward your balance/),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 rejected payment/)).toBeInTheDocument();
  });

  it("shows who recorded a payment logged on the member's behalf", () => {
    render(
      <PaymentLog
        reg={{
          id: "r1",
          payments: [
            {
              amount: 500,
              status: "verified",
              recordedBy: "Officer Reyes",
              proofs: [],
            },
          ],
        }}
      />,
    );
    expect(screen.getByText(/recorded by Officer Reyes/)).toBeInTheDocument();
  });

  it("normalizes a pre-payments registration into a single entry", () => {
    render(
      <PaymentLog
        reg={{
          id: "r1",
          amountPaid: 500,
          paymentStatus: "verified",
          paymentProofs: [{ url: "https://x/old.png", fileName: "old.png" }],
        }}
      />,
    );
    expect(screen.getByText("Payment 1")).toBeInTheDocument();
    expect(screen.getByText("₱500")).toBeInTheDocument();
    expect(screen.getByText("old.png")).toBeInTheDocument();
  });
});
