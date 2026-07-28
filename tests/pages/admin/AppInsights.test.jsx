/**
 * Tests for the Admin App Insights page.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, makeAdminAuth, climbFixture, registrationFixture } from "@tests/helpers";
import AppInsights from "@/pages/admin/AppInsights";
import { getDocs } from "firebase/firestore";
import { makeQuerySnapshot } from "@tests/setup";

describe("Admin AppInsights", () => {
  beforeEach(() => {
    getDocs.mockResolvedValue(makeQuerySnapshot([]));
  });

  it("renders the App Insights heading", async () => {
    renderWithProviders(<AppInsights />, makeAdminAuth());
    await waitFor(() =>
      expect(
        screen.getByText("App Insights", { selector: ".admin-page-title" }),
      ).toBeInTheDocument(),
    );
  });

  it("shows overview stat tiles computed from loaded data", async () => {
    getDocs.mockResolvedValue(
      makeQuerySnapshot([
        { id: climbFixture.id, data: climbFixture },
        { id: registrationFixture.id, data: registrationFixture },
      ]),
    );
    renderWithProviders(<AppInsights />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Total Climbs")).toBeInTheDocument(),
    );
    expect(screen.getByText("Active Registrations")).toBeInTheDocument();
    expect(screen.getByText("Recent Admin Activity")).toBeInTheDocument();
  });
});
