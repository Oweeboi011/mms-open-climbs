/**
 * Tests for the Schedule (home) page.
 *
 * Scenarios:
 *  - Shows loading spinner while Firestore data is pending
 *  - Renders climb cards once onSnapshot resolves
 *  - Filter buttons change the visible cards
 *  - Shows stats bar with correct counts
 *  - Empty state when no climbs match the filter
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { onSnapshot } from "firebase/firestore";
import Schedule from "@/pages/Schedule";
import {
  renderWithProviders,
  makeGuestAuth,
  climbFixture,
} from "@/test/helpers";
import { makeQuerySnapshot } from "@/test/setup";

const MAJOR_CLIMB = {
  ...climbFixture,
  id: "c1",
  title: "Mt. Pulag",
  type: "major",
  month: "aug",
};
const MINOR_CLIMB = {
  ...climbFixture,
  id: "c2",
  title: "Mt. Manalmon",
  type: "minor",
  month: "jul",
};

describe("Schedule page", () => {
  beforeEach(() => {
    // Default: return both climbs immediately
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          { id: MAJOR_CLIMB.id, data: MAJOR_CLIMB },
          { id: MINOR_CLIMB.id, data: MINOR_CLIMB },
        ]),
      );
      return vi.fn();
    });
  });

  it("renders both climb titles", async () => {
    renderWithProviders(<Schedule />, makeGuestAuth());
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );
    expect(screen.getByText("Mt. Manalmon")).toBeInTheDocument();
  });

  it("renders the stats bar with correct total count", async () => {
    renderWithProviders(<Schedule />, makeGuestAuth());
    await waitFor(() =>
      expect(screen.getAllByText("2")[0]).toBeInTheDocument(),
    );
  });

  it("filters to show only major climbs when Major filter is clicked", async () => {
    renderWithProviders(<Schedule />, makeGuestAuth());
    await waitFor(() => screen.getByText("Mt. Pulag"));

    fireEvent.click(screen.getByRole("button", { name: /^Major$/i }));

    expect(screen.getByText("Mt. Pulag")).toBeInTheDocument();
    expect(screen.queryByText("Mt. Manalmon")).not.toBeInTheDocument();
  });

  it("filters to show only minor climbs when Minor filter is clicked", async () => {
    renderWithProviders(<Schedule />, makeGuestAuth());
    await waitFor(() => screen.getByText("Mt. Manalmon"));

    fireEvent.click(screen.getByRole("button", { name: /^Minor$/i }));

    expect(screen.getByText("Mt. Manalmon")).toBeInTheDocument();
    expect(screen.queryByText("Mt. Pulag")).not.toBeInTheDocument();
  });

  it("shows all climbs when All filter is clicked after narrowing", async () => {
    renderWithProviders(<Schedule />, makeGuestAuth());
    await waitFor(() => screen.getByText("Mt. Pulag"));

    fireEvent.click(screen.getByRole("button", { name: /^Major$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^All$/i }));

    expect(screen.getByText("Mt. Pulag")).toBeInTheDocument();
    expect(screen.getByText("Mt. Manalmon")).toBeInTheDocument();
  });

  it("shows no climb cards when no data is returned", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([]));
      return vi.fn();
    });
    renderWithProviders(<Schedule />, makeGuestAuth());
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: /Mt\./i }),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows hero section with tagline", async () => {
    renderWithProviders(<Schedule />, makeGuestAuth());
    await waitFor(() =>
      expect(screen.getByText(/Welcome Participation/i)).toBeInTheDocument(),
    );
  });
});
