/**
 * Tests for the Register page.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
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
      // Once in the summary list, once beneath the checkbox itself.
      await waitFor(() =>
        expect(
          screen.getAllByText(/agree to the Waiver and Release of Liability/i)
            .length,
        ).toBeGreaterThan(0),
      );
    });

    it("keeps the submit button enabled when the waiver is unchecked", async () => {
      render();
      await waitFor(() =>
        expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
      );
      // A disabled button gives the user no way to find out what's wrong.
      expect(
        screen.getByRole("button", { name: /Submit Registration/i }),
      ).not.toBeDisabled();
    });

    it("marks the first invalid field and scrolls it into view", async () => {
      const scrollIntoView = vi.fn();
      // jsdom does not implement scrollIntoView.
      Element.prototype.scrollIntoView = scrollIntoView;

      const { container } = render();
      await waitFor(() =>
        expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
      );

      fireEvent.change(controlByLabel(container, "Full Name"), {
        target: { value: "" },
      });
      fireEvent.submit(
        screen
          .getByRole("button", { name: /Submit Registration/i })
          .closest("form"),
      );

      await waitFor(() =>
        expect(controlByLabel(container, "Full Name")).toHaveClass(
          "input-error",
        ),
      );
      expect(controlByLabel(container, "Full Name")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(scrollIntoView).toHaveBeenCalled();
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
      expect(missingItems).toContain("Enter your mobile number.");
      expect(missingItems).toContain("Enter your emergency contact's name.");
      expect(missingItems).toContain(
        "Enter your emergency contact's mobile number.",
      );
      expect(missingItems).toContain("Type your full name to sign the waiver.");
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

  describe("when the climb requires documents", () => {
    // Kept off the shared climbFixture on purpose — turning on a doc
    // requirement there would ripple into the Event / MyRegistrations / card
    // suites.
    const docClimb = {
      ...climbFixture,
      status: "open",
      requiresRegistrationForm: true,
      registrationFormUrl: "https://example.org/form.pdf",
    };

    beforeEach(() => {
      getDoc.mockResolvedValue(makeSnapshot(climbFixture.id, docClimb));
      getDocs.mockResolvedValue(makeQuerySnapshot([]));
    });

    function fillMinimum(container) {
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
    }

    it("registers with a required document still missing", async () => {
      const { container } = render();
      await waitFor(() =>
        expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
      );
      fillMinimum(container);
      fireEvent.click(
        screen.getByRole("button", { name: /Submit Registration/i }),
      );

      await waitFor(() =>
        expect(screen.getByText("Confirm Registration")).toBeInTheDocument(),
      );
      expect(screen.getByText(/Still to upload:/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Confirm & Submit/i }));
      await waitFor(() => expect(addDoc).toHaveBeenCalled());
      expect(addDoc.mock.calls[0][1].registrationFormUpload).toBeNull();
    });

    it("shows the docs-still-needed box on the success screen", async () => {
      const { container } = render();
      await waitFor(() =>
        expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
      );
      fillMinimum(container);
      fireEvent.click(
        screen.getByRole("button", { name: /Submit Registration/i }),
      );
      await waitFor(() =>
        expect(screen.getByText("Confirm Registration")).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /Confirm & Submit/i }));

      await waitFor(() =>
        expect(screen.getByText(/Registration Submitted/i)).toBeInTheDocument(),
      );
      expect(screen.getByText(/we still need your/i)).toBeInTheDocument();
      expect(
        screen.getByText(/we still need your/i).textContent,
      ).toMatch(/Registration Form/);
    });

    it("does not add the document to the missing-fields summary", async () => {
      render();
      await waitFor(() =>
        expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
      );
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
      const items = screen
        .getAllByRole("listitem")
        .map((li) => li.textContent);
      expect(items).toContain("Enter your mobile number.");
      expect(items).not.toContain("Upload your signed registration form.");
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
