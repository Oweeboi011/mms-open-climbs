/**
 * Tests for the public Release Notes history page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { onSnapshot } from "firebase/firestore";
import { renderWithProviders } from "@tests/helpers";
import { makeQuerySnapshot } from "@tests/setup";
import ReleaseNotes from "@/pages/ReleaseNotes";

const noteDoc = {
  id: "note-1",
  data: {
    title: "New Registration Flow",
    body: "Registering for climbs is now faster.",
    publishedAt: { toDate: () => new Date("2026-07-01") },
  },
};

describe("ReleaseNotes page", () => {
  it("shows an empty state when there are no notes", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([]));
      return vi.fn();
    });
    renderWithProviders(<ReleaseNotes />);
    await waitFor(() =>
      expect(screen.getByText("No release notes yet.")).toBeInTheDocument(),
    );
  });

  it("lists published release notes", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([noteDoc]));
      return vi.fn();
    });
    renderWithProviders(<ReleaseNotes />);
    await waitFor(() => {
      expect(screen.getByText("New Registration Flow")).toBeInTheDocument();
      expect(
        screen.getByText("Registering for climbs is now faster."),
      ).toBeInTheDocument();
    });
  });
});
