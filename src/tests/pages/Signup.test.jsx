/**
 * Tests for the Signup page.
 */
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import Signup from "@/pages/Signup";
import { renderWithProviders, makeGuestAuth } from "@/test/helpers";

describe("Signup page", () => {
  function setup(authOverrides = {}) {
    const result = renderWithProviders(
      <Signup />,
      makeGuestAuth(authOverrides),
    );
    const passwordInputs = result.container.querySelectorAll(
      'input[type="password"]',
    );
    return {
      ...result,
      displayNameInput: result.container.querySelector(
        'input[placeholder="Juan dela Cruz"]',
      ),
      emailInput: result.container.querySelector('input[type="email"]'),
      passwordInput: passwordInputs[0], // first password field
      confirmInput: passwordInputs[1], // confirm password field
    };
  }

  it("renders all form fields and submit button", () => {
    const { displayNameInput, emailInput, passwordInput, confirmInput } =
      setup();
    expect(displayNameInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(confirmInput).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create Account/i }),
    ).toBeInTheDocument();
  });

  it("shows error when passwords do not match", async () => {
    const { displayNameInput, emailInput, passwordInput, confirmInput } =
      setup();
    fireEvent.change(displayNameInput, { target: { value: "Test User" } });
    fireEvent.change(emailInput, { target: { value: "t@t.com" } });
    fireEvent.change(passwordInput, { target: { value: "password1" } });
    fireEvent.change(confirmInput, { target: { value: "password2" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));
    await waitFor(() =>
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument(),
    );
  });

  it("shows error when password is shorter than 8 characters", async () => {
    const { displayNameInput, emailInput, passwordInput, confirmInput } =
      setup();
    fireEvent.change(displayNameInput, { target: { value: "Test User" } });
    fireEvent.change(emailInput, { target: { value: "t@t.com" } });
    fireEvent.change(passwordInput, { target: { value: "short" } });
    fireEvent.change(confirmInput, { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));
    await waitFor(() =>
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument(),
    );
  });

  it("calls signup() with display name, email and password when form is valid", async () => {
    const signup = vi.fn(() => Promise.resolve());
    const { displayNameInput, emailInput, passwordInput, confirmInput } = setup(
      { signup },
    );
    fireEvent.change(displayNameInput, { target: { value: "Juan Cruz" } });
    fireEvent.change(emailInput, { target: { value: "juan@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.change(confirmInput, { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));
    await waitFor(() =>
      expect(signup).toHaveBeenCalledWith(
        "juan@example.com",
        "password123",
        "Juan Cruz",
      ),
    );
  });

  it("shows error when signup() rejects with email-already-in-use", async () => {
    const err = Object.assign(new Error("in use"), {
      code: "auth/email-already-in-use",
    });
    const signup = vi.fn(() => Promise.reject(err));
    const { displayNameInput, emailInput, passwordInput, confirmInput } = setup(
      { signup },
    );
    fireEvent.change(displayNameInput, { target: { value: "Juan Cruz" } });
    fireEvent.change(emailInput, { target: { value: "taken@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.change(confirmInput, { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/An account with this email already exists/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows a Google sign-in button", () => {
    setup();
    expect(
      screen.getByRole("button", { name: /Continue with Google/i }),
    ).toBeInTheDocument();
  });
});
