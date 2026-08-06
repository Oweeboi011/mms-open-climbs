/**
 * Tests for the Admin Release Notes Manage page.
 */
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { onSnapshot } from "firebase/firestore";
import { renderWithProviders, makeAdminAuth } from "@tests/helpers";
import { makeQuerySnapshot } from "@tests/setup";
import AdminReleaseNotesManage from "@/pages/admin/ReleaseNotesManage";

const noteDoc = {
  id: "note-1",
  data: {
    title: "New Registration Flow",
    status: "published",
    emailSentAt: { toDate: () => new Date("2026-07-02") },
    emailSentCount: 12,
    createdAt: { toDate: () => new Date("2026-07-01") },
  },
};
const noteDoc2 = {
  id: "note-2",
  data: {
    title: "Upcoming Maintenance",
    status: "draft",
    createdAt: { toDate: () => new Date("2026-07-03") },
  },
};

describe("Admin ReleaseNotesManage", () => {
  it("shows an empty state when there are no notes", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([]));
      return vi.fn();
    });
    renderWithProviders(<AdminReleaseNotesManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("No release notes yet.")).toBeInTheDocument(),
    );
  });

  it("lists release notes with status and email counts", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([noteDoc, noteDoc2]));
      return vi.fn();
    });
    renderWithProviders(<AdminReleaseNotesManage />, makeAdminAuth());

    await waitFor(() => {
      expect(screen.getByText("New Registration Flow")).toBeInTheDocument();
      expect(screen.getByText("Upcoming Maintenance")).toBeInTheDocument();
    });
    expect(screen.getByText("published")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
    expect(screen.getByText("12 sent")).toBeInTheDocument();
  });

  it("links to the new release note form", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([noteDoc]));
      return vi.fn();
    });
    renderWithProviders(<AdminReleaseNotesManage />, makeAdminAuth());

    await waitFor(() =>
      expect(screen.getByText("New Registration Flow")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("link", { name: /New Release Note/i }),
    ).toHaveAttribute("href", "/admin/release-notes/new");
    expect(screen.getByRole("link", { name: /Edit/i })).toHaveAttribute(
      "href",
      "/admin/release-notes/note-1/edit",
    );
  });
});
