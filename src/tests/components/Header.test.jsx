/**
 * Tests for Header component.
 *
 * Scenarios:
 *  - Guest: shows Sign In and Join links, no admin link
 *  - Member: shows My Climbs and Sign Out, no admin link
 *  - Admin: shows Admin link
 *  - Sign Out button calls logout
 *  - Hamburger button toggles aria-expanded
 */
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import Header from "@/components/Header";
import {
  renderWithProviders,
  makeGuestAuth,
  makeMemberAuth,
  makeAdminAuth,
} from "@/test/helpers";

describe("Header — guest", () => {
  it("shows Sign In and Join links", () => {
    renderWithProviders(<Header />, makeGuestAuth());
    expect(
      screen.getAllByRole("link", { name: /Sign In/i }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /Join/i }).length,
    ).toBeGreaterThan(0);
  });

  it("does not show My Climbs or Admin links", () => {
    renderWithProviders(<Header />, makeGuestAuth());
    expect(screen.queryByText(/My Climbs/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Admin/i)).not.toBeInTheDocument();
  });
});

describe("Header — member", () => {
  it("shows user display name", () => {
    renderWithProviders(<Header />, makeMemberAuth());
    // Display name appears in desktop nav and mobile nav
    expect(screen.getAllByText("Juan Cruz").length).toBeGreaterThan(0);
  });

  it("shows My Climbs link", () => {
    renderWithProviders(<Header />, makeMemberAuth());
    expect(screen.getAllByText(/My Climbs/i).length).toBeGreaterThan(0);
  });

  it("does not show Admin link", () => {
    renderWithProviders(<Header />, makeMemberAuth());
    expect(
      screen.queryByRole("link", { name: /Admin/i }),
    ).not.toBeInTheDocument();
  });

  it("calls logout when Sign Out is clicked", async () => {
    const auth = makeMemberAuth();
    renderWithProviders(<Header />, auth);
    const btn = screen.getAllByRole("button", { name: /Sign Out/i })[0];
    fireEvent.click(btn);
    expect(auth.logout).toHaveBeenCalledOnce();
  });
});

describe("Header — admin", () => {
  it("shows the Admin navigation link", () => {
    renderWithProviders(<Header />, makeAdminAuth());
    expect(screen.getAllByText(/Admin/i).length).toBeGreaterThan(0);
  });
});

describe("Header — hamburger", () => {
  it("toggles aria-expanded when hamburger is clicked", () => {
    renderWithProviders(<Header />, makeGuestAuth());
    const ham = screen.getByRole("button", { name: /Open menu/i });
    expect(ham).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(ham);
    expect(ham).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(ham);
    expect(ham).toHaveAttribute("aria-expanded", "false");
  });
});
