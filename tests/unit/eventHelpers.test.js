/**
 * Pure helpers pulled out of the event page: forecast window planning, slot
 * maths and map/trail parsing.
 */
import { describe, it, expect } from "vitest";
import { planForecast, getWeatherLabel } from "@/utils/weather";
import { getSlotSummary } from "@/utils/slotSummary";
import { getClimbCoords, getMapEmbed, getTrailMapEntries } from "@/utils/eventMaps";

const NOW = new Date("2026-10-05T09:00:00");
const day = (n) => new Date(NOW.getTime() + n * 86400000);

describe("planForecast", () => {
  it("waits for dates", () => {
    expect(planForecast(null, null, NOW).status).toBe("unavailable");
  });

  it("stops for past events", () => {
    expect(planForecast(day(-5), day(-4), NOW).message).toMatch(/past event/);
  });

  it("schedules events beyond the 16-day window", () => {
    expect(planForecast(day(20), day(21), NOW).status).toBe("scheduled");
  });

  it("requests the event window, truncated at the forecast horizon", () => {
    const plan = planForecast(day(14), day(18), NOW);
    expect(plan.status).toBeUndefined();
    expect(plan.truncated).toBe(true);
    expect(plan.requestEnd < day(18)).toBe(true);
  });

  it("accepts Firestore timestamps", () => {
    const ts = { toDate: () => day(2) };
    expect(planForecast(ts, ts, NOW).truncated).toBe(false);
  });

  it("labels unknown weather codes generically", () => {
    expect(getWeatherLabel(12345)).toBe("Weather update");
  });
});

describe("getSlotSummary", () => {
  it("reports seats left and fill level", () => {
    expect(getSlotSummary({ maxParticipants: 10, registrationCount: 9 })).toEqual({
      seatsLeft: 1,
      isFull: false,
      fillPct: 90,
      fillClass: "low",
    });
  });

  it("caps the bar at 100% when overbooked", () => {
    const s = getSlotSummary({ maxParticipants: 10, registrationCount: 12 });
    expect(s.isFull).toBe(true);
    expect(s.fillPct).toBe(100);
    expect(s.fillClass).toBe("full");
  });
});

describe("eventMaps", () => {
  it("prefers explicit coordinates over the map link", () => {
    expect(getClimbCoords({ mapLat: "16.6", mapLng: "120.9" })).toEqual({ lat: 16.6, lng: 120.9, zoom: "14" });
  });

  it("parses coordinates out of a Google Maps link", () => {
    expect(getClimbCoords({ googleMapsUrl: "https://www.google.com/maps/@16.59,120.89,13z" })).toEqual({
      lat: 16.59,
      lng: 120.89,
      zoom: "13",
    });
  });

  it("embeds a named place by name", () => {
    const { placeName, embedSrc } = getMapEmbed("https://www.google.com/maps/place/Mt+Pulag/@16.5,120.8,12z", null);
    expect(placeName).toBe("Mt Pulag");
    expect(embedSrc).toContain(encodeURIComponent("Mt Pulag"));
  });

  it("falls back to the legacy single trail fields", () => {
    expect(getTrailMapEntries({ komootUrl: "https://komoot.com/tour/1" })).toEqual([
      { label: "", googleMapsUrl: undefined, allTrailsUrl: undefined, komootUrl: "https://komoot.com/tour/1" },
    ]);
    expect(getTrailMapEntries({})).toEqual([]);
  });
});
