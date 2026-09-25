import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { getDoc, getDocs } from "firebase/firestore";
import { renderAtRoute, makeAdminAuth } from "@tests/helpers";
import { makeSnapshot, makeQuerySnapshot } from "@tests/setup";
import ClimbDaySheet from "@/pages/admin/ClimbDaySheet";

describe("Climb-day sheet", () => {
  beforeEach(() => {
    getDoc.mockImplementation((ref) =>
      Promise.resolve(
        ref.path.includes("climbPrivate")
          ? makeSnapshot("c1", {})
          : makeSnapshot("c1", {
              title: "Mt. Pulag",
              dateLabel: "Oct 3–5",
              location: "Benguet",
              fees: [{ label: "Climb Fee", amount: "1000" }],
              officers: [{ name: "Lead Ana", role: "Team Leader", contact: "0917 111 2222" }],
            }),
      ),
    );
    getDocs.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: "r1",
          data: {
            name: "Ben Cruz",
            status: "confirmed",
            mobile: "0917 000 0000",
            emergencyContact: { name: "Maria Cruz", relationship: "Mother", mobile: "0918" },
            medicalConditions: "Asthma",
            waiverSigned: true,
          },
        },
        { id: "r2", data: { name: "Wait Listed", status: "waitlisted" } },
        { id: "r3", data: { name: "Cara Cancelled", status: "cancelled" } },
      ]),
    );
  });

  function render() {
    return renderAtRoute(<ClimbDaySheet />, "/admin/climbs/:id/sheet", "/admin/climbs/c1/sheet", makeAdminAuth());
  }

  it("lists expected participants with their safety details and officers", async () => {
    render();
    expect(await screen.findByText("Ben Cruz")).toBeInTheDocument();
    expect(screen.getByText(/Maria Cruz/)).toBeInTheDocument();
    expect(screen.getByText("Asthma")).toBeInTheDocument();
    expect(screen.getByText("Lead Ana")).toBeInTheDocument();
    expect(screen.getByText(/0917 111 2222/)).toBeInTheDocument();
    // Everyone is listed; the ones not expected are flagged.
    expect(screen.getByText("Wait Listed")).toBeInTheDocument();
    expect(screen.getByText("WAITLISTED")).toBeInTheDocument();
    expect(screen.getByText("Cara Cancelled").closest("tr")).toHaveClass("daysheet-row-cancelled");
    expect(screen.getByText("CANCELLED")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Present")).toHaveLength(3);
    // Nothing paid yet against the ₱1,000 fee.
    expect(screen.getAllByText("₱1,000").length).toBeGreaterThan(0);
    expect(screen.getByText(/Confidential/)).toBeInTheDocument();
  });

  it("prints on request", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render();
    fireEvent.click(await screen.findByRole("button", { name: /Print/i }));
    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });
});
