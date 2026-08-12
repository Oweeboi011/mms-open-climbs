/**
 * Tests for Admin ClimbForm page.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { addDoc, getDocs, setDoc } from "firebase/firestore";
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
    renderAtRoute(
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
      screen.getByRole("option", { name: /Class 6/i }),
    ).toBeInTheDocument();
  });

  it("submits selected trail class in payload", async () => {
    renderAtRoute(
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

  it("adds a trail map entry and submits it, syncing the legacy single-URL fields", async () => {
    renderAtRoute(
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

    fireEvent.change(controlByLabel("Climb Title"), { target: { value: "Mt. Sample" } });
    fireEvent.change(controlByLabel("Date Label"), { target: { value: "Jul 1-2" } });
    fireEvent.change(controlByLabel("Start Date"), { target: { value: "2026-07-01" } });
    fireEvent.change(controlByLabel("End Date"), { target: { value: "2026-07-02" } });
    fireEvent.change(controlByLabel("Location"), { target: { value: "Benguet" } });

    fireEvent.click(screen.getByRole("button", { name: /\+ Add Trail/i }));
    fireEvent.change(screen.getByPlaceholderText(/Trail label/i), {
      target: { value: "Trail A — Ambangeg" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("https://www.google.com/maps/@15.717,119.935,14z"),
      { target: { value: "https://www.google.com/maps/@16.5,120.8,14z" } },
    );

    fireEvent.click(screen.getByRole("button", { name: /Create Climb/i }));

    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    const payload = addDoc.mock.calls[0][1];
    expect(payload.trailMaps).toEqual([
      {
        label: "Trail A — Ambangeg",
        googleMapsUrl: "https://www.google.com/maps/@16.5,120.8,14z",
        allTrailsUrl: "",
      },
    ]);
    expect(payload.googleMapsUrl).toBe("https://www.google.com/maps/@16.5,120.8,14z");
  });

  it("adds an announcement and submits it in the payload", async () => {
    renderAtRoute(
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

    fireEvent.change(controlByLabel("Climb Title"), { target: { value: "Mt. Sample" } });
    fireEvent.change(controlByLabel("Date Label"), { target: { value: "Jul 1-2" } });
    fireEvent.change(controlByLabel("Start Date"), { target: { value: "2026-07-01" } });
    fireEvent.change(controlByLabel("End Date"), { target: { value: "2026-07-02" } });
    fireEvent.change(controlByLabel("Location"), { target: { value: "Benguet" } });

    fireEvent.click(screen.getByRole("button", { name: /\+ Add Announcement/i }));
    fireEvent.change(screen.getByPlaceholderText("Announcement text"), {
      target: { value: "Bring extra water, trail is dry season." },
    });
    fireEvent.click(screen.getByLabelText(/Pin as reminder/i));

    fireEvent.click(screen.getByRole("button", { name: /Create Climb/i }));

    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    const payload = addDoc.mock.calls[0][1];
    expect(payload.announcements).toHaveLength(1);
    expect(payload.announcements[0]).toMatchObject({
      message: "Bring extra water, trail is dry season.",
      pinned: true,
    });
  });

  it("writes pre-climb meeting details and resource links to climbPrivate, not the public climb doc", async () => {
    renderAtRoute(
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

    fireEvent.change(controlByLabel("Climb Title"), { target: { value: "Mt. Sample" } });
    fireEvent.change(controlByLabel("Date Label"), { target: { value: "Jul 1-2" } });
    fireEvent.change(controlByLabel("Start Date"), { target: { value: "2026-07-01" } });
    fireEvent.change(controlByLabel("End Date"), { target: { value: "2026-07-02" } });
    fireEvent.change(controlByLabel("Location"), { target: { value: "Benguet" } });

    fireEvent.click(screen.getByRole("button", { name: /\+ Add Meeting/i }));
    fireEvent.change(controlByLabel("Meeting Date"), { target: { value: "2026-06-25" } });
    fireEvent.change(controlByLabel("MS Teams / Zoom Link"), {
      target: { value: "https://zoom.us/j/123" },
    });
    fireEvent.change(controlByLabel("Meeting Recording Link"), {
      target: { value: "https://youtu.be/abc123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /\+ Add Resource/i }));
    fireEvent.change(screen.getByPlaceholderText("Label (e.g. Packing Tracker)"), {
      target: { value: "Packing Tracker" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://docs.google.com/spreadsheets/…"), {
      target: { value: "https://sheets.google.com/xyz" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Climb/i }));

    await waitFor(() => expect(setDoc).toHaveBeenCalled());
    const climbPayload = addDoc.mock.calls[0][1];
    expect(climbPayload.preClimbMeetings).toBeUndefined();
    expect(climbPayload.resources).toBeUndefined();

    const [, privatePayload] = setDoc.mock.calls[0];
    expect(privatePayload.preClimbMeetings).toEqual([
      {
        date: "2026-06-25",
        time: "",
        location: "",
        link: "https://zoom.us/j/123",
        recordingLink: "https://youtu.be/abc123",
        notes: "",
      },
    ]);
    expect(privatePayload.resources).toEqual([
      { label: "Packing Tracker", url: "https://sheets.google.com/xyz" },
    ]);
  });

  it("toggles required documents and reveals the template upload field", async () => {
    renderAtRoute(
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

    expect(
      screen.queryByText("Registration Form Template"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByLabelText(/Require a signed registration form upload/i),
    );

    expect(screen.getByText("Registration Form Template")).toBeInTheDocument();

    expect(screen.queryByText("Sample Permit (for reference)")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByLabelText(/Require a mountaineering \/ trekking permit upload/i),
    );
    expect(screen.getByText("Sample Permit (for reference)")).toBeInTheDocument();

    expect(
      screen.queryByText("Waiver of Responsibility Template"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByLabelText(/Require a waiver of responsibility upload/i),
    );
    expect(
      screen.getByText("Waiver of Responsibility Template"),
    ).toBeInTheDocument();

    fireEvent.change(controlByLabel("Climb Title"), { target: { value: "Mt. Sample" } });
    fireEvent.change(controlByLabel("Date Label"), { target: { value: "Jul 1-2" } });
    fireEvent.change(controlByLabel("Start Date"), { target: { value: "2026-07-01" } });
    fireEvent.change(controlByLabel("End Date"), { target: { value: "2026-07-02" } });
    fireEvent.change(controlByLabel("Location"), { target: { value: "Benguet" } });

    fireEvent.click(screen.getByRole("button", { name: /Create Climb/i }));

    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    const payload = addDoc.mock.calls[0][1];
    expect(payload.requiresRegistrationForm).toBe(true);
    expect(payload.requiresPermit).toBe(true);
    expect(payload.requiresWaiverDoc).toBe(true);
  });
});
