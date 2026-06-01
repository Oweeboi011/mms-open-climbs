/**
 * Tests for the Admin Climb Detail page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import {
  renderAtRoute,
  makeAdminAuth,
  climbFixture,
  registrationFixture,
} from "@/test/helpers";
import ClimbDetail from "@/pages/admin/ClimbDetail";
import { getDoc, onSnapshot } from "firebase/firestore";
import { makeSnapshot, makeQuerySnapshot } from "@/test/setup";

describe("Admin ClimbDetail", () => {
  beforeEach(() => {
    getDoc.mockResolvedValue(
      makeSnapshot(climbFixture.id, { ...climbFixture }),
    );
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
});
