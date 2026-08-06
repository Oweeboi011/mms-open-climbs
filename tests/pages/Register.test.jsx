/**
 * Tests for the Register page.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderAtRoute, makeMemberAuth, climbFixture } from "@tests/helpers";
import Register from "@/pages/Register";
import { getDoc, getDocs, addDoc } from "firebase/firestore";
import { makeSnapshot, makeQuerySnapshot } from "@tests/setup";

function controlByLabel(container, labelText) {
  const label = Array.from(container.querySelectorAll("label")).find((l) =>
    l.textContent.trim().startsWith(labelText),
  );
  return label.closest(".form-group")?.querySelector("input,select,textarea");
}

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

    it("lists every missing required field at once, not just the first one", async () => {
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
        expect(
          screen.getByText("Please complete the following before submitting:"),
        ).toBeInTheDocument(),
      );
      const missingItems = screen
        .getAllByRole("listitem")
        .map((li) => li.textContent);
      expect(missingItems).toContain("Mobile Number");
      expect(missingItems).toContain("Emergency Contact Name");
      expect(missingItems).toContain("Emergency Contact Mobile");
      expect(missingItems).toContain("Digital Signature");
    });

    it("shows a confirmation modal before submitting, and only registers after confirming", async () => {
      const { container } = render();
      await waitFor(() =>
        expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
      );

      fireEvent.change(controlByLabel(container, "Mobile Number"), {
        target: { value: "09171234567" },
      });
      fireEvent.change(controlByLabel(container, "Contact Name"), {
        target: { value: "Maria Cruz" },
      });
      fireEvent.change(controlByLabel(container, "Contact Mobile"), {
        target: { value: "09179876543" },
      });
      fireEvent.change(controlByLabel(container, "Relationship"), {
        target: { value: "Mother" },
      });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.change(
        screen.getByPlaceholderText("Type your complete legal name"),
        { target: { value: "Juan Cruz" } },
      );

      fireEvent.click(screen.getByRole("button", { name: /Submit Registration/i }));

      await waitFor(() =>
        expect(screen.getByText("Confirm Registration")).toBeInTheDocument(),
      );
      expect(addDoc).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: /Confirm & Submit/i }));

      await waitFor(() => expect(addDoc).toHaveBeenCalled());
    });

    it("tells members they can pay in batches before the climb", async () => {
      render();
      await waitFor(() =>
        expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
      );
      expect(screen.getByText(/You can pay in batches\./i)).toBeInTheDocument();
      expect(
        screen.getByText(/fully paid before the climb date/i),
      ).toBeInTheDocument();
      expect(screen.getByText("Payment Notes (Optional)")).toBeInTheDocument();
    });

    it("records the first payment as a history entry, with the note", async () => {
      const { container } = render();
      await waitFor(() =>
        expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
      );

      fireEvent.change(controlByLabel(container, "Mobile Number"), {
        target: { value: "09171234567" },
      });
      fireEvent.change(controlByLabel(container, "Contact Name"), {
        target: { value: "Maria Cruz" },
      });
      fireEvent.change(controlByLabel(container, "Contact Mobile"), {
        target: { value: "09179876543" },
      });
      fireEvent.change(controlByLabel(container, "Relationship"), {
        target: { value: "Mother" },
      });
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.change(
        screen.getByPlaceholderText("Type your complete legal name"),
        { target: { value: "Juan Cruz" } },
      );

      fireEvent.change(controlByLabel(container, "Amount Paid"), {
        target: { value: "300" },
      });
      fireEvent.change(
        container.querySelector('input[accept*="image"]'),
        {
          target: {
            files: [new File(["r"], "gcash.jpg", { type: "image/jpeg" })],
          },
        },
      );
      fireEvent.change(
        screen.getByPlaceholderText(/downpayment only, balance to follow/i),
        { target: { value: "downpayment, balance next week" } },
      );

      fireEvent.click(screen.getByRole("button", { name: /Submit Registration/i }));
      await waitFor(() =>
        expect(screen.getByText("Confirm Registration")).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /Confirm & Submit/i }));

      await waitFor(() => expect(addDoc).toHaveBeenCalled());
      const payload = addDoc.mock.calls[0][1];
      expect(payload.payments).toHaveLength(1);
      expect(payload.payments[0].amount).toBe(300);
      expect(payload.payments[0].note).toBe("downpayment, balance next week");
      expect(payload.amountPaid).toBe(300);
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
