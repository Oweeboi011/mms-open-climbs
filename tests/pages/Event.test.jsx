/**
 * Tests for the Event (climb detail) page.
 *
 * Scenarios:
 *  - Shows loading spinner while data is being fetched
 *  - Renders climb title and location when loaded
 *  - Shows Register button for authenticated users on open climbs
 *  - Does not show Register button for guests (redirects handled by routes)
 *  - Shows Already Registered badge when user is already registered
 *  - Redirects to / when climb does not exist
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { getDoc, getDocs } from "firebase/firestore";
import Event from "@/pages/Event";
import {
  renderAtRoute,
  makeGuestAuth,
  makeMemberAuth,
  climbFixture,
} from "@tests/helpers";
import { makeSnapshot, makeQuerySnapshot } from "@tests/setup";

const OPEN_CLIMB = { ...climbFixture, status: "open", googleMapsUrl: null };

function mockWeatherFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((url) => {
      if (String(url).includes("geocoding-api.open-meteo.com")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  name: "Benguet",
                  admin1: "Cordillera Administrative Region",
                  country: "Philippines",
                  latitude: 16.5,
                  longitude: 120.8,
                },
              ],
            }),
        });
      }

      if (String(url).includes("api.open-meteo.com")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              daily: {
                time: ["2026-08-01"],
                weather_code: [63],
                temperature_2m_max: [22.4],
                temperature_2m_min: [14.3],
                precipitation_probability_max: [70],
                precipitation_sum: [8.1],
                wind_speed_10m_max: [18.2],
              },
            }),
        });
      }

      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    }),
  );
}

function makeNearDate(daysAhead = 3) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(0, 0, 0, 0);
  return date;
}

describe("Event page", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mockWeatherFetch();
    // Default: climb exists
    getDoc.mockResolvedValue(makeSnapshot("climb-1", OPEN_CLIMB));
    // Default: no existing registrations
    getDocs.mockResolvedValue(makeQuerySnapshot([]));
  });

  it("renders the climb title once data loads", async () => {
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );
  });

  it("renders the climb location", async () => {
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );
    await waitFor(() =>
      expect(screen.getByText(/Benguet/i)).toBeInTheDocument(),
    );
  });

  it("shows a download link for an uploaded permit sample in the Requirements section", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot("climb-1", {
        ...OPEN_CLIMB,
        requiresPermit: true,
        permitSampleUrl: "https://example.com/permit-sample.pdf",
      }),
    );

    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /View Sample Permit/i }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("link", { name: /View Sample Permit/i }),
    ).toHaveAttribute("href", "https://example.com/permit-sample.pdf");
  });

  it("does not show a download link when no sample has been uploaded for a required document", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot("climb-1", {
        ...OPEN_CLIMB,
        requiresPermit: true,
      }),
    );

    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Mountaineering / Trekking Permit"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("link", { name: /View Sample Permit/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Register button for authenticated members on open climb", async () => {
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeMemberAuth(),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /Register/i }),
      ).toBeInTheDocument(),
    );
  });

  it("does not show the direct Register link for unauthenticated guests", async () => {
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );
    await waitFor(() => screen.getByText("Mt. Pulag"));
    // Guests see "Sign In to Register" — NOT the direct /register/:id link
    expect(
      screen.queryByRole("link", { name: /^Register for this Climb$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Sign In to Register/i }),
    ).toBeInTheDocument();
  });

  it("still offers a guest an account CTA when the climb is full", async () => {
    // isFull used to be checked before !currentUser, so a signed-out visitor
    // to a full climb hit a dead-end warning with no way to sign up at all.
    getDoc.mockResolvedValue(
      makeSnapshot("climb-1", {
        ...OPEN_CLIMB,
        maxParticipants: 10,
        registrationCount: 10,
      }),
    );
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );
    await waitFor(() => screen.getByText("Mt. Pulag"));
    // Full climb → a guest still gets a "Create a free account" way in
    // (previously this branch dead-ended with a warning and no CTA).
    expect(
      screen
        .getByRole("link", { name: /Create a free account/i })
        .getAttribute("href"),
    ).toBe("/signup?redirect=/register/climb-1");
  });

  it("does not promise a waitlist that does not exist", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot("climb-1", {
        ...OPEN_CLIMB,
        maxParticipants: 10,
        registrationCount: 10,
      }),
    );
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeMemberAuth(),
    );
    await waitFor(() => screen.getByText("Mt. Pulag"));
    expect(screen.queryByText(/waitlist/i)).not.toBeInTheDocument();
  });

  it("sends the primary CTA to register and the secondary prompt back to the event page", async () => {
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );
    await waitFor(() => screen.getByText("Mt. Pulag"));
    // Primary CTA — register intent.
    expect(
      screen
        .getByRole("link", { name: /Sign In to Register/i })
        .getAttribute("href"),
    ).toBe("/login?redirect=/register/climb-1");
    // Secondary "see the rest of this page" prompt — returns here after auth.
    const createAccount = screen.getAllByRole("link", {
      name: /Create Account/i,
    });
    expect(
      createAccount.some(
        (a) => a.getAttribute("href") === "/signup?redirect=%2Fevent%2Fclimb-1",
      ),
    ).toBe(true);
  });

  it("shows Already Registered when user has a pending registration", async () => {
    getDocs.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: "reg-1",
          data: { status: "pending", climbId: "climb-1", userId: "user-1" },
        },
      ]),
    );
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeMemberAuth(),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Already Registered|Registered/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows Pre-Climb Meetings and Resources for a registered member", async () => {
    getDoc.mockImplementation((ref) => {
      if (ref.path.includes("climbPrivate")) {
        return Promise.resolve(
          makeSnapshot("climb-1", {
            preClimbMeetings: [
              {
                date: "2026-07-30",
                time: "6:00 PM",
                location: "MMS Clubhouse",
                link: "https://zoom.us/j/123",
              },
              {
                date: "2026-07-15",
                time: "7:00 PM",
                location: "Online",
              },
            ],
            resources: [{ label: "Packing Tracker", url: "https://sheets.google.com/xyz" }],
          }),
        );
      }
      return Promise.resolve(makeSnapshot("climb-1", OPEN_CLIMB));
    });
    getDocs.mockResolvedValue(
      makeQuerySnapshot([
        { id: "reg-1", data: { status: "confirmed", climbId: "climb-1", userId: "user-1" } },
      ]),
    );
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeMemberAuth(),
    );
    await waitFor(() => {
      expect(screen.getByText("Pre-Climb Meetings")).toBeInTheDocument();
      expect(screen.getByText("Join Meeting")).toBeInTheDocument();
      expect(screen.getByText(/July 30, 2026/)).toBeInTheDocument();
      expect(screen.getByText(/July 15, 2026/)).toBeInTheDocument();
      expect(screen.getByText("Climb Resources")).toBeInTheDocument();
      expect(screen.getByText("Packing Tracker")).toBeInTheDocument();
    });
  });

  it("does not show Pre-Climb Meetings or Resources for a non-registered viewer", async () => {
    getDoc.mockImplementation((ref) => {
      if (ref.path.includes("climbPrivate")) {
        return Promise.resolve(
          makeSnapshot("climb-1", {
            preClimbMeetings: [{ date: "2026-07-30" }],
            resources: [{ label: "Packing Tracker", url: "https://sheets.google.com/xyz" }],
          }),
        );
      }
      return Promise.resolve(makeSnapshot("climb-1", OPEN_CLIMB));
    });
    // No registration for this user — climbPrivate should never even be fetched.
    getDocs.mockResolvedValue(makeQuerySnapshot([]));
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeMemberAuth(),
    );
    await waitFor(() =>
      expect(screen.getByText("Mt. Pulag")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Pre-Climb Meeting")).not.toBeInTheDocument();
    expect(screen.queryByText("Climb Resources")).not.toBeInTheDocument();
  });

  it("shows the climb type label", async () => {
    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );
    await waitFor(() =>
      expect(screen.getByText(/Major Climb/i)).toBeInTheDocument(),
    );
  });

  it("shows an automatic forecast for the event dates", async () => {
    // Use a date 3 days from now so it falls within the 15-day forecast window
    const nearDate = makeNearDate(3);

    getDoc.mockResolvedValue(
      makeSnapshot("climb-1", {
        ...OPEN_CLIMB,
        startDate: { toDate: () => nearDate },
        endDate: { toDate: () => nearDate },
      }),
    );

    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );

    // Wait for the actual forecast data card to appear (not just the loading message)
    await waitFor(() =>
      expect(screen.getByText(/Rain chance: 70%/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Forecast area:/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Windy.com/i }),
    ).toBeInTheDocument();
  });

  it("shows the trail class tile when trailClass is provided", async () => {
    const nearDate = makeNearDate(3);
    getDoc.mockResolvedValue(
      makeSnapshot("climb-1", {
        ...OPEN_CLIMB,
        trailClass: "4",
        startDate: { toDate: () => nearDate },
        endDate: { toDate: () => nearDate },
      }),
    );

    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );

    await waitFor(() =>
      expect(screen.getByText("Class 4")).toBeInTheDocument(),
    );
    expect(screen.getByText("Easy climbing")).toBeInTheDocument();
  });

  it("shows a scheduled forecast message for far future dates", async () => {
    const farDate = makeNearDate(30);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    getDoc.mockResolvedValue(
      makeSnapshot("climb-1", {
        ...OPEN_CLIMB,
        startDate: { toDate: () => farDate },
        endDate: { toDate: () => farDate },
      }),
    );

    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/Detailed forecast becomes available automatically/i),
      ).toBeInTheDocument(),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows an unavailable message for past event dates", async () => {
    const pastDate = makeNearDate(-3);
    getDoc.mockResolvedValue(
      makeSnapshot("climb-1", {
        ...OPEN_CLIMB,
        startDate: { toDate: () => pastDate },
        endDate: { toDate: () => pastDate },
      }),
    );

    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          /Live forecast is no longer shown for past event dates/i,
        ),
      ).toBeInTheDocument(),
    );
  });

  it("shows missing date guidance when event dates are not set", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot("climb-1", {
        ...OPEN_CLIMB,
        startDate: null,
        endDate: null,
      }),
    );

    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          /Weather forecast will appear once the event dates are set/i,
        ),
      ).toBeInTheDocument(),
    );
  });

  it("shows a lookup error when weather location cannot be resolved", async () => {
    const nearDate = makeNearDate(3);
    vi.stubGlobal(
      "fetch",
      vi.fn((url) => {
        if (String(url).includes("geocoding-api.open-meteo.com")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ results: [] }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
      }),
    );

    getDoc.mockResolvedValue(
      makeSnapshot("climb-1", {
        ...OPEN_CLIMB,
        mapLat: null,
        mapLng: null,
        googleMapsUrl: null,
        location: "Unknown Mountain",
        startDate: { toDate: () => nearDate },
        endDate: { toDate: () => nearDate },
      }),
    );

    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeGuestAuth(),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/Weather location could not be resolved/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows pinned announcements before regular ones", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot("climb-1", {
        ...OPEN_CLIMB,
        announcements: [
          { message: "Regular update", pinned: false, createdAt: 1000 },
          { message: "Trail closed on the north side", pinned: true, createdAt: 500 },
        ],
      }),
    );

    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeMemberAuth(),
    );

    await waitFor(() =>
      expect(screen.getByText("Announcements")).toBeInTheDocument(),
    );
    const messages = screen.getAllByText(/Regular update|Trail closed/);
    expect(messages[0]).toHaveTextContent("Trail closed on the north side");
    expect(messages[1]).toHaveTextContent("Regular update");
  });

  it("shows a tab per trail option and switches the active trail map", async () => {
    getDoc.mockResolvedValue(
      makeSnapshot("climb-1", {
        ...OPEN_CLIMB,
        trailMaps: [
          {
            label: "Trail A",
            allTrailsUrl: "https://www.alltrails.com/trail/philippines/trail-a",
          },
          {
            label: "Trail B",
            allTrailsUrl: "https://www.alltrails.com/trail/philippines/trail-b",
          },
        ],
      }),
    );

    renderAtRoute(
      <Event />,
      "/event/:climbId",
      "/event/climb-1",
      makeMemberAuth(),
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Trail A" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Trail B" })).toBeInTheDocument();

    let iframe = document.querySelector("iframe[title='AllTrails trail map']");
    expect(iframe.src).toContain("trail-a");

    fireEvent.click(screen.getByRole("button", { name: "Trail B" }));

    await waitFor(() => {
      iframe = document.querySelector("iframe[title='AllTrails trail map']");
      expect(iframe.src).toContain("trail-b");
    });
  });
});
