/**
 * Tests for the Admin Climb Detail page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import {
  renderAtRoute,
  makeAdminAuth,
  climbFixture,
  registrationFixture,
} from "@tests/helpers";
import ClimbDetail from "@/pages/admin/ClimbDetail";
import { getDoc, getDocs, addDoc, onSnapshot } from "firebase/firestore";
import { makeSnapshot, makeQuerySnapshot } from "@tests/setup";

const memberDoc = {
  id: "user-2",
  data: { displayName: "Maria Santos", email: "maria@example.com" },
};

describe("Admin ClimbDetail", () => {
  beforeEach(() => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, { ...climbFixture }),
    );
    getDocs.mockResolvedValue(makeQuerySnapshot([memberDoc]));
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          { id: registrationFixture.id, data: registrationFixture },
        ]),
      );
      return vi.fn();
    });
  });

  function render() {
    return renderAtRoute(
      <ClimbDetail />,
      "/admin/climbs/:id",
      `/admin/climbs/${climbFixture.id}`,
      makeAdminAuth(),
    );
  }

  it("renders the climb title as the page heading", async () => {
    render();
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag", { selector: ".admin-page-title" })).toBeInTheDocument(),
    );
  });

  it("lists registrant names after data loads", async () => {
    render();
    await waitFor(() =>
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
    );
  });

  it("shows registration status badges", async () => {
    render();
    await waitFor(() =>
      // "pending" status badge — use getAllByText to avoid matching select <option> too
      expect(screen.getAllByText(/pending/i).length).toBeGreaterThan(0),
    );
  });

  it("shows a link back to admin climbs list", async () => {
    render();
    // Use anchored regex so "My Climbs" nav link is excluded
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /^Climbs$/i })).toBeInTheDocument(),
    );
  });

  it("lets an admin pick an existing member when adding a joiner", async () => {
    render();
    await waitFor(() =>
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Add Joiner/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: /Maria Santos/i }),
      ).toBeInTheDocument(),
    );

    const memberSelect = screen.getByText("Existing Member", {
      selector: "label",
    }).closest(".form-group").querySelector("select");
    fireEvent.change(memberSelect, { target: { value: "user-2" } });

    fireEvent.click(
      screen.getByRole("button", { name: /Add Participant/i }),
    );

    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    const payload = addDoc.mock.calls[0][1];
    expect(payload.userId).toBe("user-2");
    expect(payload.name).toBe("Maria Santos");
    expect(payload.email).toBe("maria@example.com");
  });
});
