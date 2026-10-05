import { useEffect, useState } from "react";
import { fetchDailyForecast, geocodePlace } from "@/services/weather";
import { getClimbCoords, parseGoogleMapsPlace } from "@/utils/eventMaps";
import { planForecast } from "@/utils/weather";

// The event's daily forecast, once the climb is within the 16 days the
// forecast covers. `status` is idle | unavailable | scheduled | loading |
// ready | error, with a member-facing `message` for every state but ready.
export default function useWeatherForecast(climb) {
  const [weather, setWeather] = useState({
    status: "idle",
    daily: [],
    message: "",
    coords: null,
    locationLabel: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      if (!climb) return;

      const climbCoords = getClimbCoords(climb);
      const locationQuery =
        parseGoogleMapsPlace(climb.googleMapsUrl) || climb.location;
      const base = { daily: [], coords: climbCoords, locationLabel: climb.location || "" };
      const plan = planForecast(climb.startDate, climb.endDate);
      if (plan.status) {
        setWeather({ ...base, ...plan });
        return;
      }
      const { eventStart, requestEnd, truncated } = plan;

      setWeather({
        status: "loading",
        daily: [],
        message: "Loading latest forecast…",
        coords: climbCoords,
        locationLabel: climb.location || "",
      });

      try {
        let resolvedCoords = climbCoords;
        let resolvedLocationLabel = climb.location || "";

        if (!resolvedCoords) {
          if (!locationQuery) {
            throw new Error("Add a location or map link to load weather.");
          }
          const place = await geocodePlace(locationQuery);
          resolvedCoords = place.coords;
          resolvedLocationLabel = place.label;
        }

        const dailyForecast = await fetchDailyForecast(resolvedCoords, eventStart, requestEnd);

        if (!cancelled) {
          setWeather({
            status: dailyForecast.length ? "ready" : "unavailable",
            daily: dailyForecast,
            message: dailyForecast.length
              ? truncated
                ? "Showing the currently available forecast window. Remaining event days will appear automatically closer to the climb."
                : "Forecast refreshes automatically based on the saved event dates."
              : "Forecast data is not available for this event yet.",
            coords: resolvedCoords,
            locationLabel: resolvedLocationLabel,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setWeather({
            status: "error",
            daily: [],
            message:
              error.message || "Unable to load the weather forecast right now.",
            coords: climbCoords,
            locationLabel: climb.location || "",
          });
        }
      }
    }

    loadWeather();

    return () => {
      cancelled = true;
    };
  }, [climb]);

  return weather;
}
