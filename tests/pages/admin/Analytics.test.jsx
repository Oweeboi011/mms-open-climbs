/**
 * Tests for the Admin Site Analytics page.
 */
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, makeAdminAuth } from "@tests/helpers";
import Analytics from "@/pages/admin/Analytics";
import { listPageViewsSince, listFailedRequestsSince } from "@/services/analytics";

vi.mock("@/services/analytics", () => ({
  listPageViewsSince: vi.fn(() =>
    Promise.resolve([
      { id: "v1", path: "/event/c1", climbId: "c1", userId: "u1", sessionId: "s1", timestamp: { toDate: () => new Date() } },
    ]),
  ),
  listFailedRequestsSince: vi.fn(() => Promise.resolve([])),
}));
vi.mock("@/services/climbs", () => ({
  listAllClimbs: vi.fn(() => Promise.resolve([{ id: "c1", title: "Mt. Pulag" }])),
}));
vi.mock("@/services/users", () => ({
  listUsers: vi.fn(() => Promise.resolve([{ id: "u1", displayName: "Juan Cruz" }])),
}));

describe("Admin Analytics", () => {
  it("loads a bounded 30-day window and renders the page", async () => {
    renderWithProviders(<Analytics />, makeAdminAuth());
    expect(await screen.findByText("Site Analytics")).toBeInTheDocument();
    expect(listPageViewsSince).toHaveBeenCalledWith(30, 2000);
    expect(listFailedRequestsSince).toHaveBeenCalledWith(30, 300);
  });
});
