/**
 * Tests for WelcomeModal.
 *
 * The modal auto-opens on first login. Signing up from a climb page lands on
 * /register/:climbId, so an unconditional auto-open throws a 5-step guide over
 * the exact form the user was reaching for — and its "Get Started" link used
 * to navigate to "/", discarding the redirect that had just been honored.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import WelcomeModal from "@/components/WelcomeModal";
import { renderAtRoute, makeMemberAuth } from "@tests/helpers";

describe("WelcomeModal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("auto-opens on the schedule for a first-time user", async () => {
    renderAtRoute(<WelcomeModal />, "/", "/", makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );
  });

  it("does not auto-open over the registration form", () => {
    renderAtRoute(
      <WelcomeModal />,
      "/register/:climbId",
      "/register/climb-1",
      makeMemberAuth(),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("still shows the guide later, once the user reaches the schedule", async () => {
    // Deferral, not suppression: the seen-flag is only written by dismiss().
    const { unmount } = renderAtRoute(
      <WelcomeModal />,
      "/register/:climbId",
      "/register/climb-1",
      makeMemberAuth(),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();

    renderAtRoute(<WelcomeModal />, "/", "/", makeMemberAuth());
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );
  });

  it("closes on Get Started without navigating away", async () => {
    renderAtRoute(<WelcomeModal />, "/", "/", makeMemberAuth());
    await waitFor(() => screen.getByRole("dialog"));

    // Walk to the last step, where the final action lives.
    for (;;) {
      const next = screen.queryByRole("button", { name: /^Next$/ });
      if (!next) break;
      fireEvent.click(next);
    }

    const getStarted = screen.getByRole("button", { name: /Get Started/i });
    // A <button>, not a <Link to="/"> — dismissing must reveal the page the
    // redirect delivered, not replace it.
    expect(getStarted.tagName).toBe("BUTTON");
    fireEvent.click(getStarted);

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
