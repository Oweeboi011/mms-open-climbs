import { describe, it, expect, vi, afterEach } from "vitest";
import { geocodePlace } from "@/services/weather";

// Open-Meteo results by searched name, shaped like the real API.
function stubSearch(byName) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url) => {
      const name = new URL(url).searchParams.get("name");
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: byName[name] }) });
    }),
  );
}

const place = (name, admin2, admin1, lat, countryCode = "PH") => ({
  name,
  admin1,
  admin2,
  country: countryCode === "PH" ? "Philippines" : "Elsewhere",
  country_code: countryCode,
  latitude: lat,
  longitude: 120,
});

afterEach(() => vi.unstubAllGlobals());

describe("geocodePlace", () => {
  it("resolves 'Town, Province' by searching the town", async () => {
    stubSearch({ Kibungan: [place("Kibungan", "Province of Benguet", "Cordillera", 16.7)] });
    const result = await geocodePlace("Kibungan, Benguet");
    expect(result.coords.lat).toBe(16.7);
    expect(result.label).toBe("Kibungan, Province of Benguet, Philippines");
  });

  it("picks the same-named place in the province given after the comma", async () => {
    stubSearch({
      "San Jose": [
        place("San Jose", "Province of Batangas", "Calabarzon", 13.8),
        place("San Jose", "Province of Nueva Ecija", "Central Luzon", 15.8),
      ],
    });
    const result = await geocodePlace("San Jose, Nueva Ecija");
    expect(result.coords.lat).toBe(15.8);
  });

  it("prefers a Philippine place when nothing else tells them apart", async () => {
    stubSearch({ Tanay: [place("Tanay", "", "Abroad", 1, "XX"), place("Tanay", "Province of Rizal", "Calabarzon", 14.5)] });
    expect((await geocodePlace("Tanay")).coords.lat).toBe(14.5);
  });

  it("falls back to the next part when the first isn't a known place", async () => {
    stubSearch({ "Mt. Pulag": [], Kabayan: [place("Kabayan", "Province of Benguet", "Cordillera", 16.6)] });
    expect((await geocodePlace("Mt. Pulag, Kabayan, Benguet")).coords.lat).toBe(16.6);
  });

  it("explains when no part resolves", async () => {
    stubSearch({});
    await expect(geocodePlace("Nowhere")).rejects.toThrow("Weather location could not be resolved.");
  });
});
