import { formatForecastDate, getWeatherLabel, toIsoDate } from "@/utils/weather";

// Open-Meteo: free, keyless and CORS-enabled, so the browser calls it directly.

async function searchPlaces(name) {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=en&format=json`,
  );
  if (!response.ok) throw new Error("Weather location lookup failed.");
  return (await response.json()).results || [];
}

// Matches on the rest of the location ("Benguet" in "Kibungan, Benguet")
// first, then on the club's home country.
function scorePlace(place, context) {
  const regions = [place.admin1, place.admin2, place.admin3, place.country]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const matches = context.filter((part) => regions.includes(part.toLowerCase())).length;
  return matches * 2 + (place.country_code === "PH" ? 1 : 0);
}

// Open-Meteo searches one place name, so "Kibungan, Benguet" finds nothing.
// Try each comma-separated part in turn, using the parts after it to pick
// between same-named places.
export async function geocodePlace(query) {
  const parts = String(query).split(",").map((p) => p.trim()).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const results = await searchPlaces(parts[i]);
    if (results.length === 0) continue;
    const context = parts.slice(i + 1);
    const best = results.reduce((a, b) => (scorePlace(b, context) > scorePlace(a, context) ? b : a));
    return {
      coords: { lat: Number(best.latitude), lng: Number(best.longitude), zoom: "10" },
      label: [best.name, best.admin2 || best.admin1, best.country].filter(Boolean).join(", "),
    };
  }
  throw new Error("Weather location could not be resolved.");
}

const DAILY_FIELDS =
  "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max";

export async function fetchDailyForecast(coords, startDate, endDate) {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&daily=${DAILY_FIELDS}&timezone=auto&start_date=${toIsoDate(startDate)}&end_date=${toIsoDate(endDate)}`,
  );
  if (!response.ok) throw new Error("Weather forecast request failed.");
  const { daily = {} } = await response.json();
  return (daily.time || []).map((date, index) => ({
    date,
    label: formatForecastDate(date),
    weatherCode: daily.weather_code?.[index],
    weatherLabel: getWeatherLabel(daily.weather_code?.[index]),
    maxTemp: daily.temperature_2m_max?.[index],
    minTemp: daily.temperature_2m_min?.[index],
    precipitationProbability: daily.precipitation_probability_max?.[index],
    precipitationTotal: daily.precipitation_sum?.[index],
    maxWindSpeed: daily.wind_speed_10m_max?.[index],
  }));
}
