/**
 * Tests for the Register page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderAtRoute, makeMemberAuth, climbFixture } from "@/test/helpers";
import Register from "@/pages/Register";
import { getDoc, getDocs } from "firebase/firestore";
import { makeSnapshot, makeQuerySnapshot } from "@/test/setup";

function render(authOverrides = {}) {
  return renderAtRoute(
    <Register />,
    "/register/:climbId",
    `/register/${climbFixture.id}`,
    makeMemberAuth(authOverrides),
  );
}

describe("Register page", () => {
  describe("when the climb is open", () => {
    beforeEach(() => {
      // Climb exists and is open
      getDoc.mockResolvedValue(
        makeSnapshot(climbFixture.id, { ...climbFixture, status: "open" }),
      );
      // No existing registration
      getDocs.mockResolvedValue(makeQuerySnapshot([]));
    });

    it("renders the climb title in the form heading", async () => {
      render();
      await waitFor(() =>
        expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
      );
    });

    it("pre-fills Full Name from user profile", async () => {
      render();
      await waitFor(() => {
        const input = screen.getByDisplayValue("Juan Cruz");
        expect(input).toBeInTheDocument();
      });
    });

    it("shows the waiver agreement checkbox", async () => {
      render();
      await waitFor(() =>
        expect(screen.getByRole("checkbox")).toBeInTheDocument(),
      );
    });

    it("shows a validation error when waiver is not agreed", async () => {
      render();
      await waitFor(() =>
        expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
      );

      // fireEvent.submit bypasses jsdom's HTML5 required-field validation
      fireEvent.submit(
        screen
          .getByRole("button", { name: /Submit Registration/i })
          .closest("form"),
      );
      await waitFor(() =>
        expect(screen.getByText(/agree to the waiver/i)).toBeInTheDocument(),
      );
    });
  });

  describe("when the climb is closed", () => {
    it("navigates away when the climb status is not open", async () => {
      getDoc.mockResolvedValue(
        makeSnapshot(climbFixture.id, { ...climbFixture, status: "closed" }),
      );
      getDocs.mockResolvedValue(makeQuerySnapshot([]));
      render();
      // The form heading should never appear
      await waitFor(() =>
        expect(
          screen.queryByRole("button", { name: /Submit Registration/i }),
        ).not.toBeInTheDocument(),
      );
    });
  });

  describe("when already registered", () => {
    it("navigates to my-registrations if user has an active registration", async () => {
      getDoc.mockResolvedValue(
        makeSnapshot(climbFixture.id, { ...climbFixture, status: "open" }),
      );
      getDocs.mockResolvedValue(
        makeQuerySnapshot([
          { id: "reg-existing", data: { status: "confirmed" } },
        ]),
      );
      render();
      await waitFor(() =>
        expect(
          screen.queryByRole("button", { name: /Submit Registration/i }),
        ).not.toBeInTheDocument(),
      );
    });
  });
});
