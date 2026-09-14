/**
 * Tests for the Admin Climbs Manage page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import {
  renderWithProviders,
  makeAdminAuth,
  climbFixture,
} from "@tests/helpers";
import AdminClimbsManage from "@/pages/admin/ClimbsManage";
import { onSnapshot, updateDoc } from "firebase/firestore";
import { makeQuerySnapshot } from "@tests/setup";

const climbDoc = {
  id: climbFixture.id,
  data: {
    ...climbFixture,
    title: "Mt. Pulag",
    fees: [
      { label: "Registration Fee", amount: "500", optional: false },
      { label: "Guide Fee", amount: "700", optional: false },
      { label: "Transportation Fee", amount: "300", optional: true },
      { label: "Guest Fee", amount: "450", optional: true, isGuestFee: true },
    ],
  },
};
const climbDoc2 = {
  id: "climb-2",
  data: {
    ...climbFixture,
    id: "climb-2",
    title: "Mt. Apo",
    location: "Davao",
    status: "draft",
  },
};

// The page listens to climbs, registrations and climbPrivate; hand each
// listener its own collection.
function routeSnapshots({
  climbs = [climbDoc, climbDoc2],
  registrations = [],
  climbPrivate = [],
} = {}) {
  onSnapshot.mockImplementation((target, cb) => {
    const path = (Array.isArray(target) ? target[0]?.path : target?.path) ?? "";
    const docs =
      path === "registrations"
        ? registrations
        : path === "climbPrivate"
          ? climbPrivate
          : climbs;
    cb(makeQuerySnapshot(docs));
    return vi.fn();
  });
}

const reg = (id, data) => ({
  id,
  data: { climbId: climbFixture.id, status: "confirmed", ...data },
});

// Mt. Pulag's required fees come to ₱1,200, plus the ₱450 guest fee for
// joiners.
const juanOwesAll = reg("r-juan", {
  name: "Juan Cruz",
  email: "juan@example.com",
  memberType: "joiner",
  paymentStatus: "unpaid",
});
const mariaOwesPart = reg("r-maria", {
  name: "Maria Santos",
  email: "maria@example.com",
  memberType: "member",
  paymentStatus: "verified",
  amountPaid: 700,
  payments: [{ amount: 700, proofs: [], status: "verified" }],
});
const pedroPaid = reg("r-pedro", {
  name: "Pedro Reyes",
  memberType: "member",
  paymentStatus: "verified",
  amountPaid: 1200,
  payments: [{ amount: 1200, proofs: [], status: "verified" }],
});
const anaCancelled = reg("r-ana", {
  name: "Ana Lim",
  memberType: "joiner",
  status: "cancelled",
  paymentStatus: "unpaid",
});

describe("Admin ClimbsManage", () => {
  beforeEach(() => {
    routeSnapshots();
  });

  it("renders the Climbs page heading", async () => {
    renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Climbs", { selector: ".admin-page-title" })).toBeInTheDocument(),
    );
  });

  it("lists climbs after data loads", async () => {
    renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
    await waitFor(() => {
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument();
      expect(screen.getByText("Mt. Apo")).toBeInTheDocument();
    });
  });

  it("filters climbs by search input", async () => {
    const { container } = renderWithProviders(
      <AdminClimbsManage />,
      makeAdminAuth(),
    );
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );

    const searchInput = container.querySelector("input");
    fireEvent.change(searchInput, { target: { value: "Apo" } });

    await waitFor(() => {
      expect(screen.queryByText("Mt. Pulag")).not.toBeInTheDocument();
      expect(screen.getByText("Mt. Apo")).toBeInTheDocument();
    });
  });

  it("renders a link to manage each climb", async () => {
    renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
    await waitFor(() =>
      expect(
        screen.getAllByRole("link", { name: /Manage|Details|Edit/i }).length,
      ).toBeGreaterThan(0),
    );
  });

  it("groups the table by status, ordered by relevance", async () => {
    // Grouping is by status (Open → Draft → Closed → Completed → Cancelled),
    // not by date. Within a group, completed climbs sort most-recent-first
    // and the rest soonest-first.
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          {
            id: "climb-done",
            data: {
              ...climbFixture,
              id: "climb-done",
              title: "Mt. Done",
              status: "completed",
              startDate: { toDate: () => new Date("2020-01-01") },
            },
          },
          {
            id: "climb-open",
            data: {
              ...climbFixture,
              id: "climb-open",
              title: "Mt. Open",
              status: "open",
              startDate: { toDate: () => new Date("2999-01-01") },
            },
          },
        ]),
      );
      return vi.fn();
    });

    renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
    await waitFor(() => expect(screen.getByText("Open")).toBeInTheDocument());
    expect(screen.getByText("Completed")).toBeInTheDocument();

    // Group header rows bracket their climbs in document order.
    const rowText = [...document.querySelectorAll("tbody tr")].map(
      (tr) => tr.textContent,
    );
    const openAt = rowText.findIndex((t) => t.includes("Open"));
    const completedAt = rowText.findIndex((t) => t.includes("Completed"));
    const openClimbAt = rowText.findIndex((t) => t.includes("Mt. Open"));
    const doneClimbAt = rowText.findIndex((t) => t.includes("Mt. Done"));
    expect(openAt).toBeLessThan(openClimbAt);
    expect(openClimbAt).toBeLessThan(completedAt);
    expect(completedAt).toBeLessThan(doneClimbAt);
  });

  it("shows the itemized fee breakdown when a climb row is expanded", async () => {
    renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getAllByLabelText("Expand details")[0]);

    await waitFor(() => {
      expect(screen.getByText("Registration Fee")).toBeInTheDocument();
      expect(screen.getByText("Transportation Fee")).toBeInTheDocument();
      expect(screen.getByText("Guest Fee")).toBeInTheDocument();
      // Required total — optional and guest fees are listed but not summed in.
      // Shown both in the row summary and in the expanded table's footer.
      expect(screen.getAllByText("₱1,200").length).toBeGreaterThan(0);
    });
  });

  it("summarizes fees on the row with optional and guest fees kept apart", async () => {
    renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getAllByLabelText("Expand details")[0]);

    await waitFor(() =>
      expect(
        screen.getByText("4 items — ₱1,200 required, +1 optional, +₱450 guest"),
      ).toBeInTheDocument(),
    );
  });

  it("calls updateDoc when a status is changed", async () => {
    renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );

    // The Change Status select moved into the expanded detail panel.
    fireEvent.click(screen.getAllByLabelText("Expand details")[0]);
    const select = await screen.findByRole("combobox");
    fireEvent.change(select, { target: { value: "closed" } });
    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
  });

  describe("remaining balances per climb", () => {
    it("tags the climb row with what is still owed", async () => {
      routeSnapshots({
        registrations: [juanOwesAll, mariaOwesPart, pedroPaid, anaCancelled],
      });
      renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
      await waitFor(() =>
        expect(screen.getByText("₱2,150 due")).toBeInTheDocument(),
      );
    });

    it("lists everyone with a balance in the expanded climb, and no one else", async () => {
      routeSnapshots({
        registrations: [juanOwesAll, mariaOwesPart, pedroPaid, anaCancelled],
      });
      renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
      await waitFor(() =>
        expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
      );
      fireEvent.click(screen.getAllByLabelText("Expand details")[0]);

      await waitFor(() =>
        expect(screen.getByText("Remaining Balances")).toBeInTheDocument(),
      );
      expect(screen.getByText("2 registrants · ₱2,150 due")).toBeInTheDocument();

      const juan = within(screen.getByText("Juan Cruz").closest("tr"));
      expect(juan.getByText("Joiner")).toBeInTheDocument();
      // Nothing paid yet, so the fees and the balance are the same figure.
      expect(juan.getAllByText("₱1,650")).toHaveLength(2);
      expect(juan.getByText("₱0")).toBeInTheDocument();

      const maria = within(screen.getByText("Maria Santos").closest("tr"));
      expect(maria.getByText("Member")).toBeInTheDocument();
      expect(maria.getByText("₱1,200")).toBeInTheDocument();
      expect(maria.getByText("₱700")).toBeInTheDocument();
      expect(maria.getByText("₱500")).toBeInTheDocument();

      expect(screen.queryByText("Pedro Reyes")).not.toBeInTheDocument();
      expect(screen.queryByText("Ana Lim")).not.toBeInTheDocument();
    });

    it("opens a registrant's payment history from their row", async () => {
      routeSnapshots({ registrations: [juanOwesAll, mariaOwesPart] });
      renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
      await waitFor(() =>
        expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
      );
      fireEvent.click(screen.getAllByLabelText("Expand details")[0]);
      fireEvent.click(await screen.findByText("Maria Santos"));

      const dialog = await screen.findByRole("dialog", {
        name: "Payment history for Maria Santos",
      });
      expect(within(dialog).getByText("Balance ₱500")).toBeInTheDocument();
      expect(within(dialog).getByText("Payment 1")).toBeInTheDocument();
      expect(within(dialog).getByText("₱700")).toBeInTheDocument();

      fireEvent.click(within(dialog).getByText("Close", { selector: "button" }));
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
    });

    it("says when someone with a balance hasn't paid anything yet", async () => {
      routeSnapshots({ registrations: [juanOwesAll] });
      renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
      await waitFor(() =>
        expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
      );
      fireEvent.click(screen.getAllByLabelText("Expand details")[0]);
      fireEvent.click(await screen.findByText("Juan Cruz"));

      const dialog = await screen.findByRole("dialog", {
        name: "Payment history for Juan Cruz",
      });
      expect(
        within(dialog).getByText("No payments recorded yet."),
      ).toBeInTheDocument();
    });

    it("says so when everyone on the climb is paid up", async () => {
      routeSnapshots({ registrations: [pedroPaid] });
      renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
      await waitFor(() =>
        expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
      );
      expect(screen.queryByText(/ due$/)).not.toBeInTheDocument();
      fireEvent.click(screen.getAllByLabelText("Expand details")[0]);

      await waitFor(() =>
        expect(
          screen.getByText("No one on this climb has a balance left to pay."),
        ).toBeInTheDocument(),
      );
    });

    it("leaves balances off a cancelled climb", async () => {
      routeSnapshots({
        climbs: [
          {
            id: climbFixture.id,
            data: { ...climbDoc.data, status: "cancelled" },
          },
        ],
        registrations: [juanOwesAll],
      });
      renderWithProviders(<AdminClimbsManage />, makeAdminAuth());
      await waitFor(() =>
        expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
      );
      expect(screen.queryByText(/ due$/)).not.toBeInTheDocument();
      fireEvent.click(screen.getAllByLabelText("Expand details")[0]);

      await waitFor(() =>
        expect(screen.getByText("Completeness Check")).toBeInTheDocument(),
      );
      expect(screen.queryByText("Remaining Balances")).not.toBeInTheDocument();
    });
  });
});
