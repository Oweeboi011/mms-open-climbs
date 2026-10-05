/**
 * Tests for Admin ReleaseNoteForm page.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { addDoc, updateDoc, getDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { renderAtRoute, makeAdminAuth } from "@tests/helpers";
import { makeSnapshot, makeQuerySnapshot } from "@tests/setup";
import AdminReleaseNoteForm from "@/pages/admin/ReleaseNoteForm";

// Route callables by name so each test can steer preview and send.
const callables = { previewReleaseNoteEmail: vi.fn(), sendReleaseNoteEmail: vi.fn() };
beforeEach(() => {
  for (const fn of Object.values(callables)) fn.mockReset().mockResolvedValue({ data: {} });
  httpsCallable.mockImplementation((_fns, name) => callables[name] || vi.fn(() => Promise.resolve({ data: {} })));
});

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

  const publishedNote = () =>
    getDoc.mockResolvedValue(
      makeSnapshot("note-1", { title: "Existing Note", body: "Existing body", status: "published" }),
    );
  const sender = () => makeAdminAuth({ userProfile: { role: "admin", canEmailMembers: true } });
  const openEdit = (auth) =>
    renderAtRoute(<AdminReleaseNoteForm />, "/admin/release-notes/:id/edit", "/admin/release-notes/note-1/edit", auth);

  it("only enables sending once the note is published", async () => {
    getDoc.mockResolvedValue(makeSnapshot("note-1", { title: "Existing Note", body: "Existing body", status: "draft" }));
    openEdit(sender());
    await waitFor(() => expect(screen.getByDisplayValue("Existing Note")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Preview & Send/i })).toBeDisabled();
    expect(screen.getByText(/Publish this release note before emailing it/i)).toBeInTheDocument();
  });

  it("explains the missing permission to an admin without canEmailMembers", async () => {
    publishedNote();
    openEdit(makeAdminAuth());
    await waitFor(() => expect(screen.getByDisplayValue("Existing Note")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Preview & Send/i })).toBeDisabled();
    expect(screen.getByText(/ask another admin to grant it/i)).toBeInTheDocument();
  });

  it("previews the email, sends after confirmation and shows progress", async () => {
    publishedNote();
    callables.previewReleaseNoteEmail.mockResolvedValue({
      data: { subject: "MMS Open Climbs Update: Existing Note", html: "<p>hi</p>", recipients: 5 },
    });
    callables.sendReleaseNoteEmail.mockResolvedValue({ data: { jobId: "job-1", total: 5 } });
    onSnapshot.mockImplementation((ref, cb) => {
      cb(
        ref?.path === "releaseNoteEmailJobs/job-1"
          ? makeSnapshot("job-1", { status: "sending", total: 5, sent: 2, failed: 0 })
          : makeQuerySnapshot([]),
      );
      return vi.fn();
    });

    openEdit(sender());
    await waitFor(() => expect(screen.getByDisplayValue("Existing Note")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Preview & Send/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("MMS Open Climbs Update: Existing Note");
    expect(screen.getByTitle("Email preview")).toHaveAttribute("sandbox", "");
    fireEvent.click(screen.getByRole("button", { name: "Send to 5 members" }));

    await waitFor(() => expect(callables.sendReleaseNoteEmail).toHaveBeenCalledWith({ releaseNoteId: "note-1" }));
    expect(await screen.findByText(/Sending… 2 of 5/)).toBeInTheDocument();
  });

  it("says when its send was replaced by a newer one", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot("note-1", { title: "Existing Note", body: "B", status: "published", emailJob: { id: "job-old", status: "superseded" } }),
    );
    onSnapshot.mockImplementation((ref, cb) => {
      cb(ref?.path === "releaseNoteEmailJobs/job-old" ? makeSnapshot("job-old", { status: "superseded", total: 5 }) : makeQuerySnapshot([]));
      return vi.fn();
    });
    openEdit(sender());
    expect(await screen.findByText(/replaced by a newer one/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sending…/)).not.toBeInTheDocument();
  });
});
