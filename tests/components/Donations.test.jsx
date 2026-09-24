import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { updateDoc } from "firebase/firestore";
import DonationDriveInfo from "@/components/DonationDriveInfo";
import DonationPledgeModal from "@/components/DonationPledgeModal";
import DonationsCard from "@/components/admin/DonationsCard";

const drive = {
  enabled: true,
  beneficiary: "Tanglag Elementary",
  description: "School supplies",
  acceptsCash: true,
  acceptsInKind: true,
  suggestedItems: "Notebooks\nPencils",
};

describe("DonationDriveInfo", () => {
  it("renders nothing when the climb has no drive", () => {
    const { container } = render(<DonationDriveInfo climb={{ title: "X" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the beneficiary, how to give and suggested items", () => {
    render(<DonationDriveInfo climb={{ donationDrive: drive }} />);
    expect(screen.getByText("Tanglag Elementary")).toBeInTheDocument();
    expect(screen.getByText(/handed to the climb leads/i)).toBeInTheDocument();
    expect(screen.getByText("Pencils")).toBeInTheDocument();
  });

  it("shows the running total without naming donors", () => {
    render(
      <DonationDriveInfo
        climb={{ donationDrive: drive, donationTotals: { receivedCash: 1500, donors: 3, itemDonations: 2 } }}
      />,
    );
    expect(screen.getByText(/₱1,500/)).toBeInTheDocument();
    expect(screen.getByText(/received so far/i)).toBeInTheDocument();
  });
});

describe("DonationPledgeModal", () => {
  it("saves a normalized pledge and nothing else", async () => {
    const onClose = vi.fn();
    render(
      <DonationPledgeModal
        reg={{ id: "r1", climbId: "c1", climbTitle: "Pulag" }}
        drive={drive}
        currentUser={{ uid: "u1" }}
        onClose={onClose}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: /Save pledge/i }));
    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = updateDoc.mock.calls.at(-1)[1];
    expect(Object.keys(patch).sort()).toEqual(["donation", "updatedAt"]);
    expect(patch.donation).toEqual({ cashPledge: 300, inKind: "", payWithFees: true });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("DonationsCard", () => {
  const regs = [
    { id: "a", name: "Ana", status: "confirmed", donation: { cashPledge: 500, inKind: "" } },
    { id: "b", name: "Ben", status: "confirmed", donationReceived: { cash: 200, items: "rice", receivedBy: "Lead" } },
    { id: "c", name: "Cara", status: "confirmed" },
  ];

  it("shows pledged vs received totals", () => {
    render(<DonationsCard climb={{ donationDrive: drive }} regs={regs} onRecord={vi.fn()} />);
    expect(screen.getByText(/Pledged:/).textContent).toMatch(/500/);
    expect(screen.getByText(/Received:/).textContent).toMatch(/200/);
    expect(screen.getByText("by Lead")).toBeInTheDocument();
  });

  it("records what a pledger actually handed over", async () => {
    const onRecord = vi.fn(() => Promise.resolve());
    render(<DonationsCard climb={{ donationDrive: drive }} regs={regs} onRecord={onRecord} />);
    fireEvent.click(screen.getByRole("button", { name: /Record received/i }));
    fireEvent.change(screen.getByLabelText("Cash received"), { target: { value: "450" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onRecord).toHaveBeenCalled());
    expect(onRecord.mock.calls[0][0].id).toBe("a");
    expect(onRecord.mock.calls[0][1]).toEqual({ cash: "450", items: "" });
  });

  it("can record a donation from someone who never pledged", () => {
    render(<DonationsCard climb={{ donationDrive: drive }} regs={regs} onRecord={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/another participant/i), { target: { value: "c" } });
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    expect(screen.getByLabelText("Cash received")).toBeInTheDocument();
    expect(screen.getByText("Cara")).toBeInTheDocument();
  });
});
