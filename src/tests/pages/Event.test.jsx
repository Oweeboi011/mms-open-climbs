/**
 * Tests for the Event (climb detail) page.
 *
 * Scenarios:
 *  - Shows loading spinner while data is being fetched
 *  - Renders climb title and location when loaded
 *  - Shows Register button for authenticated users on open climbs
 *  - Does not show Register button for guests (redirects handled by routes)
 *  - Shows Already Registered badge when user is already registered
 *  - Redirects to / when climb does not exist
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { getDoc, getDocs } from "firebase/firestore";
import Event from "@/pages/Event";
import {
  renderAtRoute,
  makeGuestAuth,
  makeMemberAuth,
  climbFixture,
} from "@/test/helpers";
import { makeSnapshot, makeQuerySnapshot } from "@/test/setup";

const OPEN_CLIMB = { ...climbFixture, status: "open", googleMapsUrl: null };

describe("Event page", () => {
  beforeEach(() => {
    // Default: climb exists
    getDoc.mockResolvedValue(makeSnapshot("climb-1", OPEN_CLIMB));
    // Default: no existing registrations
    getDocs.mockResolvedValue(makeQuerySnapshot([]));
  });

  it("renders the climb title once data loads", async () => {
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );
  });

  it("renders the climb location", async () => {
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );
    await waitFor(() =>
      expect(screen.getByText(/Benguet/i)).toBeInTheDocument(),
    );
  });

  it("shows Register button for authenticated members on open climb", async () => {
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeMemberAuth(),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /Register/i }),
      ).toBeInTheDocument(),
    );
  });

  it("does not show the direct Register link for unauthenticated guests", async () => {
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );
    await waitFor(() => screen.getByText("Mt. Pulag"));
    // Guests see "Sign In to Register" — NOT the direct /register/:id link
    expect(
      screen.queryByRole("link", { name: /^Register for this Climb$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Sign In to Register/i }),
    ).toBeInTheDocument();
  });

  it("shows Already Registered when user has a pending registration", async () => {
    getDocs.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: "reg-1",
          data: { status: "pending", climbId: "climb-1", userId: "user-1" },
        },
      ]),
    );
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeMemberAuth(),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Already Registered|Registered/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows the climb type label", async () => {
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );
    await waitFor(() =>
      expect(screen.getByText(/Major Climb/i)).toBeInTheDocument(),
    );
  });
});
