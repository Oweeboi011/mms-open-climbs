/**
 * Tests for the ReleaseNotesNotice "what's new" popup.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { onSnapshot, updateDoc } from "firebase/firestore";
import { renderWithProviders, makeMemberAuth, makeGuestAuth } from "@tests/helpers";
import { makeQuerySnapshot } from "@tests/setup";
import ReleaseNotesNotice from "@/components/ReleaseNotesNotice";

const noteDoc = {
  id: "note-1",
  data: {
    title: "New Registration Flow",
    body: "Registering for climbs is now faster.",
  },
};

describe("ReleaseNotesNotice", () => {
  beforeEach(() => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([noteDoc]));
      return vi.fn();
    });
  });

  it("renders nothing for a signed-out user", () => {
    const { container } = renderWithProviders(
      <ReleaseNotesNotice />,
      makeGuestAuth(),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the latest published note for a signed-in user", async () => {
    renderWithProviders(<ReleaseNotesNotice />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText("New Registration Flow")).toBeInTheDocument(),
    );
    expect(
      screen.getByText("Registering for climbs is now faster."),
    ).toBeInTheDocument();
  });

  it("does not show a note the user already dismissed", () => {
    const { container } = renderWithProviders(
      <ReleaseNotesNotice />,
      makeMemberAuth({
        userProfile: {
          displayName: "Juan Cruz",
          email: "climber@example.com",
          role: "member",
          lastSeenReleaseNoteId: "note-1",
        },
      }),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("marks the note as seen when dismissed via Got it", async () => {
    renderWithProviders(<ReleaseNotesNotice />, makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByText("New Registration Flow")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Got it/i }));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const payload = updateDoc.mock.calls[0][1];
    expect(payload.lastSeenReleaseNoteId).toBe("note-1");
  });
});
