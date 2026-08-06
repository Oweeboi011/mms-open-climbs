/**
 * Tests for the shared admin payment-history block, used by ClimbDetail,
 * ManagePayments and AllRegistrations.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PaymentHistory from "@/components/admin/PaymentHistory";

const proof = (name) => ({ url: `https://x/${name}`, fileName: name });

const regWithTwo = {
  amountPaid: 800,
  payments: [
    {
      amount: 500,
      proofs: [proof("gcash1.jpg")],
      submittedAt: { toDate: () => new Date("2026-07-01T09:30:00") },
      status: "verified",
    },
    {
      amount: 300,
      proofs: [proof("receipt.pdf")],
      submittedAt: null,
      status: "submitted",
      note: "balance for transportation",
    },
  ],
};

describe("PaymentHistory", () => {
  it("renders nothing when no payment was ever recorded", () => {
    const { container } = render(<PaymentHistory reg={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists each payment with its amount, date, note and status", () => {
    render(<PaymentHistory reg={regWithTwo} />);

    expect(screen.getByText(/Payment 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText(/Payment 2 of 2/)).toBeInTheDocument();
    expect(screen.getByText("₱500")).toBeInTheDocument();
    expect(screen.getByText("₱300")).toBeInTheDocument();
    expect(screen.getByText(/Jul 1, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/balance for transportation/)).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText(/Total across 2 payments: ₱800/)).toBeInTheDocument();
  });

  it("shows an image receipt as a thumbnail and a PDF as a link", () => {
    render(<PaymentHistory reg={regWithTwo} />);
    expect(screen.getByAltText("gcash1.jpg")).toBeInTheDocument();
    expect(screen.getByText("Open PDF")).toBeInTheDocument();
  });

  it("opens image receipts in the page lightbox when one is wired up", () => {
    const setLightboxUrl = vi.fn();
    render(<PaymentHistory reg={regWithTwo} setLightboxUrl={setLightboxUrl} />);
    fireEvent.click(screen.getByAltText("gcash1.jpg"));
    expect(setLightboxUrl).toHaveBeenCalledWith("https://x/gcash1.jpg");
  });

  it("says so when a payment came in without a receipt", () => {
    render(
      <PaymentHistory
        reg={{ payments: [{ amount: 500, proofs: [], recordedBy: "admin" }] }}
      />,
    );
    expect(
      screen.getByText("No receipt attached to this payment."),
    ).toBeInTheDocument();
    expect(screen.getByText(/recorded by admin/)).toBeInTheDocument();
  });

  it("explains that a rejected payment stopped counting toward the balance", () => {
    render(
      <PaymentHistory
        reg={{
          amountPaid: 500,
          payments: [
            { amount: 500, proofs: [], status: "verified" },
            { amount: 300, proofs: [], status: "rejected" },
          ],
        }}
      />,
    );
    expect(screen.getByText(/₱500 counts toward their balance/)).toBeInTheDocument();
    expect(screen.getByText(/1 rejected payment/)).toBeInTheDocument();
  });

  it("flags an amountPaid an admin edited away from the recorded payments", () => {
    render(
      <PaymentHistory
        reg={{ amountPaid: 1000, payments: [{ amount: 500, proofs: [] }] }}
      />,
    );
    expect(screen.getByText(/adjusted by an admin/i)).toBeInTheDocument();
  });

  it("folds a pre-`payments` registration into a single payment", () => {
    render(
      <PaymentHistory
        reg={{
          amountPaid: 500,
          paymentStatus: "verified",
          paymentProofs: [proof("old.jpg")],
        }}
      />,
    );
    expect(screen.getByText(/^Payment 1$/)).toBeInTheDocument();
    expect(screen.queryByText(/Total across/)).not.toBeInTheDocument();
  });

  it("hides the per-payment review buttons when no handler is passed", () => {
    render(<PaymentHistory reg={regWithTwo} />);
    expect(
      screen.queryByTitle(/Verify just this payment/i),
    ).not.toBeInTheDocument();
  });

  it("reviews one payment at a time, by index", () => {
    const onEntryStatusChange = vi.fn();
    render(
      <PaymentHistory
        reg={regWithTwo}
        onEntryStatusChange={onEntryStatusChange}
      />,
    );

    fireEvent.click(screen.getAllByTitle(/Verify just this payment/i)[1]);
    expect(onEntryStatusChange).toHaveBeenCalledWith(regWithTwo, 1, "verified");

    fireEvent.click(screen.getAllByTitle(/Reject just this payment/i)[0]);
    expect(onEntryStatusChange).toHaveBeenCalledWith(regWithTwo, 0, "rejected");

    fireEvent.click(screen.getAllByTitle(/back under review/i)[0]);
    expect(onEntryStatusChange).toHaveBeenCalledWith(regWithTwo, 0, "submitted");
  });

  it("disables the button matching a payment's current verdict", () => {
    render(
      <PaymentHistory reg={regWithTwo} onEntryStatusChange={vi.fn()} />,
    );
    // Payment 1 is verified, payment 2 is still awaiting review.
    expect(screen.getAllByTitle(/Verify just this payment/i)[0]).toBeDisabled();
    expect(
      screen.getAllByTitle(/Verify just this payment/i)[1],
    ).not.toBeDisabled();
    expect(screen.getAllByTitle(/back under review/i)[1]).toBeDisabled();
  });
});
