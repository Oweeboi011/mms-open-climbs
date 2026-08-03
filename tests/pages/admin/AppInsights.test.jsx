/**
 * Tests for the Admin App Insights page.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, makeAdminAuth, climbFixture, registrationFixture } from "@tests/helpers";
import AppInsights from "@/pages/admin/AppInsights";
import { getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
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

  it("automatically loads email, storage, function-health, and billing stats on mount", async () => {
    renderWithProviders(<AppInsights />, makeAdminAuth());
    await waitFor(() => {
      const calledNames = httpsCallable.mock.calls.map((c) => c[1]);
      expect(calledNames).toContain("getEmailStats");
      expect(calledNames).toContain("getStorageUsage");
      expect(calledNames).toContain("getFunctionHealth");
      expect(calledNames).toContain("getBillingCost");
    });
  });

  it("shows the billing cost breakdown when configured", async () => {
    httpsCallable.mockImplementation((_fns, name) => {
      if (name === "getBillingCost") {
        return () =>
          Promise.resolve({
            data: {
              configured: true,
              currency: "USD",
              month: "August 2026",
              totalCost: 12.5,
              byService: [{ service: "Cloud Firestore", cost: 12.5 }],
            },
          });
      }
      return () => Promise.resolve({ data: {} });
    });
    renderWithProviders(<AppInsights />, makeAdminAuth());
    await waitFor(() => {
      expect(screen.getByText("August 2026: $12.50 USD")).toBeInTheDocument();
      expect(screen.getByText("Cloud Firestore")).toBeInTheDocument();
    });
  });

  it("shows a warning when billing cost is not configured", async () => {
    httpsCallable.mockImplementation((_fns, name) => {
      if (name === "getBillingCost") {
        return () =>
          Promise.resolve({
            data: { configured: false, reason: "No billing export table configured." },
          });
      }
      return () => Promise.resolve({ data: {} });
    });
    renderWithProviders(<AppInsights />, makeAdminAuth());
    await waitFor(() =>
      expect(
        screen.getByText("No billing export table configured."),
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
