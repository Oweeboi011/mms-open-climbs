/**
 * Tests for the Login page.
 */
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import Login from "@/pages/Login";
import { renderWithProviders, makeGuestAuth } from "@/test/helpers";

describe("Login page", () => {
  function setup(authOverrides = {}) {
    const result = renderWithProviders(<Login />, makeGuestAuth(authOverrides));
    return {
      ...result,
      emailInput: result.container.querySelector('input[type="email"]'),
      passwordInput: result.container.querySelector('input[type="password"]'),
    };
  }

  it("renders the Sign In heading", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: /Sign In/i }),
    ).toBeInTheDocument();
  });

  it("renders the email and password inputs", () => {
    const { emailInput, passwordInput } = setup();
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
  });

  it("renders the Sign In submit button", () => {
    setup();
    expect(
      screen.getAllByRole("button", { name: /Sign In/i }).length,
    ).toBeGreaterThan(0);
  });

  it("renders a Google sign-in button", () => {
    setup();
    expect(
      screen.getByRole("button", { name: /Continue with Google/i }),
    ).toBeInTheDocument();
  });

  it("calls login() with email and password on form submit", async () => {
    const login = vi.fn(() => Promise.resolve());
    const { emailInput, passwordInput } = setup({ login });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "secret123" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Sign In/i })[0]);

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith("test@example.com", "secret123"),
    );
  });

  it("shows an error message when login() rejects", async () => {
    const err = Object.assign(new Error("bad"), {
      code: "auth/wrong-password",
    });
    const login = vi.fn(() => Promise.reject(err));
    const { emailInput, passwordInput } = setup({ login });

    fireEvent.change(emailInput, { target: { value: "x@x.com" } });
    fireEvent.change(passwordInput, { target: { value: "wrong" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Sign In/i })[0]);

    await waitFor(() =>
      expect(
        screen.getByText(/Invalid email or password/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows a link to Forgot Password", () => {
    setup();
    expect(
      screen.getByRole("link", { name: /Forgot password/i }),
    ).toBeInTheDocument();
  });
});
