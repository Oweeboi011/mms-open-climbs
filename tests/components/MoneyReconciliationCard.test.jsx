import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MoneyReconciliationCard from "@/components/admin/MoneyReconciliationCard";

const climb = { fees: [{ label: "Hike Package", amount: "1000" }] };
const regs = [
  { id: "a", name: "Admer D.", status: "confirmed", paymentStatus: "verified", amountPaid: 2000, payments: [{ amount: 2000, status: "verified" }] },
  { id: "b", name: "Jean V.", status: "confirmed", paymentStatus: "verified", amountPaid: 900, payments: [{ amount: 900, status: "verified" }] },
  { id: "c", name: "Dorothy R.", status: "cancelled", paymentStatus: "verified", amountPaid: 550, payments: [{ amount: 550, status: "verified" }] },
];

describe("MoneyReconciliationCard", () => {
  it("walks from owed to verified and names who is behind each step", () => {
    render(<MoneyReconciliationCard regs={regs} climb={climb} expensesTotal={500} />);
    expect(screen.getByText(/Owed by 2 active registrants/)).toBeInTheDocument();
    expect(screen.getByText("₱2,000")).toBeInTheDocument();
    expect(screen.getByText("+₱1,000")).toBeInTheDocument();
    expect(screen.getByText("−₱100")).toBeInTheDocument();
    expect(screen.getByText("+₱550")).toBeInTheDocument();
    expect(screen.getByText("₱3,450")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Paid more than they owe/));
    expect(screen.getByText("Admer D.")).toBeInTheDocument();
    expect(screen.getByText(/paid ₱2,000, owes ₱1,000/)).toBeInTheDocument();
    expect(screen.getByText("Club net funds").nextSibling.textContent).toBe("₱2,950");
  });
});
