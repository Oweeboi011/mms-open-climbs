/**
 * Tests for the NotFound page.
 */
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import NotFound from "@/pages/NotFound";
import { renderWithProviders, makeGuestAuth } from "@/test/helpers";

describe("NotFound page", () => {
  it("renders a 404 heading", () => {
    renderWithProviders(<NotFound />, makeGuestAuth());
    expect(screen.getByText(/404/i)).toBeInTheDocument();
  });

  it("renders a link back to the home page", () => {
    renderWithProviders(<NotFound />, makeGuestAuth());
    expect(
      screen.getByRole("link", { name: /Back to Schedule|Go Home|Home/i }),
    ).toBeInTheDocument();
  });
});
