/**
 * Tests for the ForgotPassword page.
 *
 * Scenarios:
 *  - Renders email field and submit button
 *  - Calls resetPassword() on submit
 *  - Shows success message after submission
 *  - Shows error when resetPassword() rejects
 */
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import ForgotPassword from "@/pages/ForgotPassword";
import { renderWithProviders, makeGuestAuth } from "@/test/helpers";

describe("ForgotPassword page", () => {
  it("renders the email input and submit button", () => {
    renderWithProviders(<ForgotPassword />, makeGuestAuth());
    expect(screen.getByPlaceholderText("your@email.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Send Reset Link/i }),
    ).toBeInTheDocument();
  });

  it("calls resetPassword() with the email on submit", async () => {
    const resetPassword = vi.fn(() => Promise.resolve());
    renderWithProviders(<ForgotPassword />, makeGuestAuth({ resetPassword }));

    fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send Reset Link/i }));

    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith("user@example.com"),
    );
  });

  it("shows a success message after a successful reset", async () => {
    const resetPassword = vi.fn(() => Promise.resolve());
    renderWithProviders(<ForgotPassword />, makeGuestAuth({ resetPassword }));

    fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send Reset Link/i }));

    await waitFor(() =>
      expect(screen.getByText(/Check your email/i)).toBeInTheDocument(),
    );
  });

  it("shows an error when resetPassword() rejects", async () => {
    const err = Object.assign(new Error("not found"), {
      code: "auth/user-not-found",
    });
    const resetPassword = vi.fn(() => Promise.reject(err));
    renderWithProviders(<ForgotPassword />, makeGuestAuth({ resetPassword }));

    fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
      target: { value: "nobody@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send Reset Link/i }));

    await waitFor(() =>
      expect(screen.queryByText(/Check your email/i)).not.toBeInTheDocument(),
    );
  });

  it("shows a link back to Sign In", () => {
    renderWithProviders(<ForgotPassword />, makeGuestAuth());
    // Header (desktop + mobile) and the page footer all have "Sign In" links for guests
    expect(
      screen.getAllByRole("link", { name: /^Sign In$/i }).length,
    ).toBeGreaterThan(0);
  });
});
