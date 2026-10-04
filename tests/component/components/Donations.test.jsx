import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
  cashGoal: 5000,
  neededItems: [
    { name: "Notebooks", target: 60, unit: "pcs" },
    { name: "Rice", target: 30, unit: "kg" },
  ],
};

describe("DonationDriveInfo", () => {
  it("renders nothing when the climb has no drive", () => {
    const { container } = render(<DonationDriveInfo climb={{ title: "X" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the beneficiary, how to give, and what is still needed per item", () => {
    render(
      <DonationDriveInfo
        climb={{
          donationDrive: drive,
          donationTotals: {
            receivedCash: 1500,
            items: [
              { name: "Notebooks", target: 60, pledged: 45, received: 10 },
              { name: "Rice", target: 30, pledged: 30, received: 0 },
            ],
          },
        }}
      />,
    );
    expect(screen.getByText("Tanglag Elementary")).toBeInTheDocument();
    expect(screen.getByText(/handed to the climb leads/i)).toBeInTheDocument();
    expect(screen.getByText("15 of 60 pcs still needed")).toBeInTheDocument();
    expect(screen.getByText(/Covered/)).toBeInTheDocument();
    expect(screen.getByText(/₱1,500 received so far/)).toBeInTheDocument();
  });

  it("still lists a legacy free-text suggestion list", () => {
    render(
      <DonationDriveInfo
        climb={{ donationDrive: { enabled: true, beneficiary: "S", acceptsInKind: true, suggestedItems: "Pencils\nCrayons" } }}
      />,
    );
    expect(screen.getByText("Crayons")).toBeInTheDocument();
  });
});

describe("DonationPledgeModal", () => {
  it("saves cash and item quantities against the drive's needs", async () => {
    const onClose = vi.fn();
    render(
      <DonationPledgeModal
        reg={{ id: "r1", climbId: "c1", climbTitle: "Pulag" }}
        drive={drive}
        climb={{ donationDrive: drive }}
        currentUser={{ uid: "u1" }}
        onClose={onClose}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Cash pledge/), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText("How many Notebooks"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /Save pledge/i }));
    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = updateDoc.mock.calls.at(-1)[1];
    expect(Object.keys(patch).sort()).toEqual(["donation", "updatedAt"]);
    expect(patch.donation).toEqual({
      cashPledge: 300,
      inKind: "",
      payWithFees: true,
      itemPledges: [{ name: "Notebooks", qty: 20 }],
    });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("DonationsCard (climb page summary)", () => {
  it("summarises progress and links to the Donations page", () => {
    const regs = [
      { id: "a", name: "Ana", status: "confirmed", donation: { cashPledge: 500, payWithFees: false, itemPledges: [{ name: "Notebooks", qty: 20 }] } },
      { id: "b", name: "Ben", status: "confirmed", donationReceived: { cash: 200, items: "", itemQuantities: [{ name: "Rice", qty: 30 }], receivedBy: "Lead" } },
    ];
    render(
      <MemoryRouter>
        <DonationsCard climb={{ id: "c1", donationDrive: drive }} regs={regs} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Cash received:/).textContent).toMatch(/₱200 of ₱5,000/);
    expect(screen.getByText(/To collect on the day:/).textContent).toMatch(/₱500/);
    expect(screen.getByText(/Still needed: 60 pcs Notebooks/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Donations/ })).toHaveAttribute(
      "href",
      "/admin/climbs/c1/donations",
    );
  });
});
