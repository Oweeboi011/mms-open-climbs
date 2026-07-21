/**
 * Tests for Admin ReleaseNoteForm page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { addDoc, updateDoc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { renderAtRoute, makeAdminAuth } from "@tests/helpers";
import { makeSnapshot } from "@tests/setup";
import AdminReleaseNoteForm from "@/pages/admin/ReleaseNoteForm";

// ReleaseNoteForm.jsx creates its callable in this file's only httpsCallable
// call at module load — grab the actual mock fn instance to control it.
const sendReleaseNoteEmailMock = httpsCallable.mock.results[0].value;

describe("Admin ReleaseNoteForm", () => {
  beforeEach(() => {
    getDoc.mockResolvedValue(makeSnapshot("note-1", null));
  });

  function controlByLabel(labelText) {
    const label = screen.getByText(labelText, { selector: "label" });
    return label.closest(".form-group")?.querySelector("input,select,textarea");
  }

  it("renders the New Release Note heading", async () => {
    renderAtRoute(
      <AdminReleaseNoteForm />,
      "/admin/release-notes/new",
      "/admin/release-notes/new",
      makeAdminAuth(),
    );
    await waitFor(() =>
      expect(
        screen.getByText("New Release Note", { selector: ".admin-page-title" }),
      ).toBeInTheDocument(),
    );
  });

  it("creates a release note with the entered title, body and status", async () => {
    renderAtRoute(
      <AdminReleaseNoteForm />,
      "/admin/release-notes/new",
      "/admin/release-notes/new",
      makeAdminAuth(),
    );
    await waitFor(() =>
      expect(
        screen.getByText("New Release Note", { selector: ".admin-page-title" }),
      ).toBeInTheDocument(),
    );

    fireEvent.change(controlByLabel("Title"), {
      target: { value: "New Registration Flow" },
    });
    fireEvent.change(controlByLabel("Body"), {
      target: { value: "Registering is now faster." },
    });
    fireEvent.change(controlByLabel("Status"), {
      target: { value: "published" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Create Release Note/i }),
    );

    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    const payload = addDoc.mock.calls[0][1];
    expect(payload.title).toBe("New Registration Flow");
    expect(payload.body).toBe("Registering is now faster.");
    expect(payload.status).toBe("published");
    expect(payload.publishedAt).toBeDefined();
  });

  it("loads an existing note into the form in edit mode", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot("note-1", {
        title: "Existing Note",
        body: "Existing body",
        status: "draft",
      }),
    );

    renderAtRoute(
      <AdminReleaseNoteForm />,
      "/admin/release-notes/:id/edit",
      "/admin/release-notes/note-1/edit",
      makeAdminAuth(),
    );

    await waitFor(() =>
      expect(screen.getByDisplayValue("Existing Note")).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("Existing body")).toBeInTheDocument();
  });

  it("saves changes via updateDoc in edit mode", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot("note-1", {
        title: "Existing Note",
        body: "Existing body",
        status: "draft",
      }),
    );

    renderAtRoute(
      <AdminReleaseNoteForm />,
      "/admin/release-notes/:id/edit",
      "/admin/release-notes/note-1/edit",
      makeAdminAuth(),
    );

    await waitFor(() =>
      expect(screen.getByDisplayValue("Existing Note")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
  });

  it("only enables Send Email once the note is published", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot("note-1", {
        title: "Existing Note",
        body: "Existing body",
        status: "draft",
      }),
    );

    renderAtRoute(
      <AdminReleaseNoteForm />,
      "/admin/release-notes/:id/edit",
      "/admin/release-notes/note-1/edit",
      makeAdminAuth(),
    );

    await waitFor(() =>
      expect(screen.getByDisplayValue("Existing Note")).toBeInTheDocument(),
    );

    expect(
      screen.getByRole("button", { name: /Send Email to All Members/i }),
    ).toBeDisabled();
  });

  it("sends the release note email after confirmation", async () => {
    window.confirm.mockReturnValue(true);
    sendReleaseNoteEmailMock.mockResolvedValue({
      data: { sent: 5, total: 5 },
    });
    getDoc.mockResolvedValue(
      makeSnapshot("note-1", {
        title: "Existing Note",
        body: "Existing body",
        status: "published",
      }),
    );

    renderAtRoute(
      <AdminReleaseNoteForm />,
      "/admin/release-notes/:id/edit",
      "/admin/release-notes/note-1/edit",
      makeAdminAuth(),
    );

    await waitFor(() =>
      expect(screen.getByDisplayValue("Existing Note")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Send Email to All Members/i }),
    );

    await waitFor(() =>
      expect(sendReleaseNoteEmailMock).toHaveBeenCalledWith({
        releaseNoteId: "note-1",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText(/Email sent to 5 of 5 members/i)).toBeInTheDocument(),
    );
  });
});
