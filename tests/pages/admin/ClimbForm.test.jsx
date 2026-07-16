/**
 * Tests for Admin ClimbForm page.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { addDoc, getDocs } from "firebase/firestore";
import { renderAtRoute, makeAdminAuth } from "@tests/helpers";
import AdminClimbForm from "@/pages/admin/ClimbForm";
import { makeQuerySnapshot } from "@tests/setup";

describe("Admin ClimbForm", () => {
  beforeEach(() => {
    getDocs.mockResolvedValue(makeQuerySnapshot([]));
  });

  function controlByLabel(labelText) {
    const label = screen.getByText(labelText, { selector: "label" });
    return label.closest(".form-group")?.querySelector("input,select,textarea");
  }

  it("renders trail class selector", async () => {
    const { container } = renderAtRoute(
      <AdminClimbForm />,
      "/admin/climbs/new",
      "/admin/climbs/new",
      makeAdminAuth(),
    );

    await waitFor(() =>
      expect(
        screen.getByText("New Climb", { selector: ".admin-page-title" }),
      ).toBeInTheDocument(),
    );

    const trailLabel = screen.getByText("Trail Class", { selector: "label" });
    const trailSelect = trailLabel
      .closest(".form-group")
      ?.querySelector("select");
    expect(trailSelect).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Class 1/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Class 9/i }),
    ).toBeInTheDocument();
  });

  it("submits selected trail class in payload", async () => {
    const { container } = renderAtRoute(
      <AdminClimbForm />,
      "/admin/climbs/new",
      "/admin/climbs/new",
      makeAdminAuth(),
    );

    await waitFor(() =>
      expect(
        screen.getByText("New Climb", { selector: ".admin-page-title" }),
      ).toBeInTheDocument(),
    );

    fireEvent.change(controlByLabel("Climb Title"), {
      target: { value: "Mt. Sample" },
    });
    fireEvent.change(controlByLabel("Date Label"), {
      target: { value: "Jul 1-2" },
    });
    fireEvent.change(controlByLabel("Start Date"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(controlByLabel("End Date"), {
      target: { value: "2026-07-02" },
    });
    fireEvent.change(controlByLabel("Location"), {
      target: { value: "Benguet" },
    });
    fireEvent.change(controlByLabel("Trail Class"), {
      target: { value: "5" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Climb/i }));

    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    const payload = addDoc.mock.calls[0][1];
    expect(payload.trailClass).toBe("5");
  });
});
