/**
 * Tests for the public Release Notes history page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("renders sectioned/bulleted bodies as headings and lists", async () => {
    const sectionedNote = {
      id: "note-2",
      data: {
        title: "What's New — August 3, 2026",
        body: "New Features\n- Add payment history\n\nFixes\n- Fix broken login link",
        publishedAt: { toDate: () => new Date("2026-08-03") },
      },
    };
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([sectionedNote]));
      return vi.fn();
    });
    renderWithProviders(<ReleaseNotes />);
    await waitFor(() => {
      expect(screen.getByText("New Features")).toBeInTheDocument();
      expect(screen.getByText("Fixes")).toBeInTheDocument();
      expect(screen.getByText("Add payment history")).toBeInTheDocument();
      expect(screen.getByText("Fix broken login link")).toBeInTheDocument();
    });
  });

  it("expands only the latest note by default, and toggles others on click", async () => {
    const latest = {
      id: "note-latest",
      data: {
        title: "Latest Update",
        body: "Latest note body.",
        publishedAt: { toDate: () => new Date("2026-08-03") },
      },
    };
    const older = {
      id: "note-older",
      data: {
        title: "Older Update",
        body: "Older note body.",
        publishedAt: { toDate: () => new Date("2026-07-01") },
      },
    };
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([latest, older]));
      return vi.fn();
    });
    renderWithProviders(<ReleaseNotes />);

    await waitFor(() => {
      expect(screen.getByText("Latest Update")).toBeInTheDocument();
      expect(screen.getByText("Older Update")).toBeInTheDocument();
    });

    expect(screen.getByText("Latest note body.")).toBeInTheDocument();
    expect(screen.queryByText("Older note body.")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText("Older Update"));
    expect(screen.getByText("Older note body.")).toBeInTheDocument();
  });
});
