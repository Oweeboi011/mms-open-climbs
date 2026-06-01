/**
 * Tests for the WaiverPrint page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import {
  renderAtRoute,
  makeMemberAuth,
  makeAdminAuth,
  registrationFixture,
} from "@/test/helpers";
import WaiverPrint from "@/pages/WaiverPrint";
import { getDoc } from "firebase/firestore";
import { makeSnapshot } from "@/test/setup";

const regData = {
  ...registrationFixture,
  name: "Juan Cruz",
  climbTitle: "Mt. Pulag",
  climbDate: "Aug 1-3, 2026",
  climbLocation: "Benguet",
  userId: "user-1", // matches makeMemberAuth uid
  waiverSignedAt: null,
};

function render(authOverrides = {}, regOverrides = {}) {
  getDoc.mockResolvedValue(
    makeSnapshot(registrationFixture.id, { ...regData, ...regOverrides }),
  );
  return renderAtRoute(
    <WaiverPrint />,
    "/waiver/:registrationId",
    `/waiver/${registrationFixture.id}`,
    makeMemberAuth(authOverrides),
  );
}

describe("WaiverPrint page", () => {
  it("renders the climber name in the waiver", async () => {
    render();
    // Name appears in both toolbar and info table — use getAllByText
    await waitFor(() =>
      expect(screen.getAllByText("Juan Cruz").length).toBeGreaterThan(0),
    );
  });

  it("renders the climb title", async () => {
    render();
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );
  });

  it("shows a Print / Save PDF button", async () => {
    render();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Print|PDF/i }),
      ).toBeInTheDocument(),
    );
  });

  it("shows a Back button in the toolbar", async () => {
    render();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument(),
    );
  });

  it("admin can also view the waiver", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot(registrationFixture.id, {
        ...regData,
        userId: "other-user",
      }),
    );
    renderAtRoute(
      <WaiverPrint />,
      "/waiver/:registrationId",
      `/waiver/${registrationFixture.id}`,
      makeAdminAuth(),
    );
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );
  });

  it("navigates away when the registration does not exist", async () => {
    getDoc.mockResolvedValue(makeSnapshot(null, null));
    render();
    // The Print button should never render
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Print|PDF/i }),
      ).not.toBeInTheDocument(),
    );
  });
});
