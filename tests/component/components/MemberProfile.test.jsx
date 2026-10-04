import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { getDoc, getDocs } from "firebase/firestore";
import { renderWithProviders, makeAdminAuth } from "@tests/helpers";
import { makeSnapshot, makeQuerySnapshot } from "@tests/setup";
import MemberProfile from "@/components/admin/MemberProfile";

describe("MemberProfile (users modal)", () => {
  beforeEach(() => {
    getDoc.mockImplementation((ref) => {
      if (ref.path.startsWith("users/")) {
        return Promise.resolve(makeSnapshot("u1", { displayName: "Ben Cruz", email: "ben@x.com", role: "member" }));
      }
      if (ref.path.startsWith("climbs/")) {
        return Promise.resolve(
          makeSnapshot("c1", {
            title: "Mt. Pulag",
            dateLabel: "Aug 1–3",
            startDate: new Date("2026-08-01"),
            endDate: new Date("2026-08-03"),
            fees: [{ label: "Fee", amount: "1000" }],
          }),
        );
      }
      return Promise.resolve(makeSnapshot("x", null));
    });
    // Every getDocs returns the one registration; the other lists (officer
    // climbs, feedback, page views, audit) tolerate its shape.
    getDocs.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: "r1",
          data: {
            climbId: "c1",
            name: "Ben Cruz",
            userId: "u1",
            status: "confirmed",
            noShow: true,
            paymentStatus: "verified",
            amountPaid: 600,
            payments: [{ amount: 600, status: "verified", submittedAt: 1000 }],
            createdAt: 500,
            mobile: "0917 000 0000",
            emergencyContact: { name: "Maria Cruz", relationship: "Mother", mobile: "0918" },
          },
        },
      ]),
    );
  });

  it("shows the member's climbs, money, attendance and activity", async () => {
    renderWithProviders(<MemberProfile uid="u1" />, makeAdminAuth());
    expect(await screen.findByRole("link", { name: "Mt. Pulag" })).toHaveAttribute("href", "/admin/climbs/c1");
    expect(screen.getByText("no-show")).toBeInTheDocument();
    expect(screen.getAllByText("₱400").length).toBeGreaterThan(0);
    expect(screen.getByText(/Maria Cruz/)).toBeInTheDocument();
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getAllByText(/Submitted a ₱600 payment/).length).toBeGreaterThan(0);
  });
});
