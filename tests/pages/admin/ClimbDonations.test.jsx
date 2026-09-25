import { describe, it, expect, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { getDoc, getDocs, updateDoc } from "firebase/firestore";
import { renderAtRoute, makeAdminAuth } from "@tests/helpers";
import { makeSnapshot, makeQuerySnapshot } from "@tests/setup";
import ClimbDonations from "@/pages/admin/ClimbDonations";

const drive = {
  enabled: true,
  beneficiary: "Tanglag Elementary",
  acceptsCash: true,
  acceptsInKind: true,
  cashGoal: 2000,
  neededItems: [{ name: "Notebooks", target: 60, unit: "pcs" }],
};

describe("Climb donations page", () => {
  beforeEach(() => {
    getDoc.mockImplementation((ref) =>
      Promise.resolve(
        ref.path.includes("climbPrivate")
          ? makeSnapshot("c1", {})
          : makeSnapshot("c1", { title: "Mt. Pulag", donationDrive: drive, fees: [] }),
      ),
    );
    getDocs.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: "r1",
          data: {
            name: "Ana Reyes",
            status: "confirmed",
            donation: { cashPledge: 500, payWithFees: false, inKind: "", itemPledges: [{ name: "Notebooks", qty: 20 }] },
          },
        },
        { id: "r2", data: { name: "Ben Cruz", status: "confirmed" } },
      ]),
    );
  });

  const render = () =>
    renderAtRoute(<ClimbDonations />, "/admin/climbs/:id/donations", "/admin/climbs/c1/donations", makeAdminAuth());

  it("shows what is needed, the cash picture, and who brings what", async () => {
    render();
    expect(await screen.findByText(/Donations — Mt. Pulag/)).toBeInTheDocument();
    // Notebooks: target 60, pledged 20, received 0 -> 60 still needed, 40 unpledged
    expect(screen.getByText("40 not yet pledged")).toBeInTheDocument();
    expect(screen.getByText("To collect on the day").nextSibling.textContent).toBe("₱500");
    expect(screen.getByText("Ana Reyes")).toBeInTheDocument();
    expect(screen.getByText("20 Notebooks")).toBeInTheDocument();
  });

  it("records what a person handed over, item by item, and republishes totals", async () => {
    render();
    fireEvent.click(await screen.findByRole("button", { name: "Record received" }));
    fireEvent.change(screen.getByLabelText("Notebooks received"), { target: { value: "18" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateDoc.mock.calls.some((c) => c[1].donationReceived)).toBe(true));
    const received = updateDoc.mock.calls.find((c) => c[1].donationReceived)[1].donationReceived;
    expect(received).toMatchObject({ cash: 500, itemQuantities: [{ name: "Notebooks", qty: 18 }] });
    const totals = updateDoc.mock.calls.find((c) => c[1].donationTotals)[1].donationTotals;
    expect(totals.items[0]).toMatchObject({ name: "Notebooks", received: 18, target: 60 });
    // Ana moves to collected; Ben can still be recorded as a non-pledger.
    await waitFor(() => expect(screen.getByText("by Admin User", { exact: false })).toBeInTheDocument());
  });
});
