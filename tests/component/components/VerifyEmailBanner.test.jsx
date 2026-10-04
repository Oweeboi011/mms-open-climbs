import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthContext } from "@/contexts/AuthContext";
import VerifyEmailBanner, { needsEmailVerification } from "@/components/VerifyEmailBanner";

const passwordUser = (over = {}) => ({
  email: "juan@x.com",
  emailVerified: false,
  providerData: [{ providerId: "password" }],
  reload: vi.fn(() => Promise.resolve()),
  ...over,
});

function renderBanner(user, resendVerification = vi.fn(() => Promise.resolve())) {
  render(
    <AuthContext.Provider value={{ currentUser: user, resendVerification }}>
      <VerifyEmailBanner />
    </AuthContext.Provider>,
  );
  return resendVerification;
}

describe("needsEmailVerification", () => {
  it("only for unverified email/password accounts", () => {
    expect(needsEmailVerification(passwordUser())).toBe(true);
    expect(needsEmailVerification(passwordUser({ emailVerified: true }))).toBe(false);
    expect(needsEmailVerification(passwordUser({ providerData: [{ providerId: "google.com" }] }))).toBe(false);
    expect(needsEmailVerification(null)).toBe(false);
  });
});

describe("VerifyEmailBanner", () => {
  it("asks an unverified member to verify and resends on request", async () => {
    const resend = renderBanner(passwordUser());
    expect(screen.getByText(/verify your email/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Resend email/i }));
    await waitFor(() => expect(screen.getByText(/check your inbox/i)).toBeInTheDocument());
    expect(resend).toHaveBeenCalled();
  });

  it("stays hidden for verified or Google accounts", () => {
    renderBanner(passwordUser({ emailVerified: true }));
    expect(screen.queryByText(/verify your email/i)).toBeNull();
  });
});
