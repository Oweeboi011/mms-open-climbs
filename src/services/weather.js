import { formatForecastDate, getWeatherLabel, toIsoDate } from "@/utils/weather";

// Open-Meteo: free, keyless and CORS-enabled, so the browser calls it directly.

export async function geocodePlace(query) {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`,
  );
  if (!response.ok) throw new Error("Weather location lookup failed.");
  const first = (await response.json()).results?.[0];
  if (!first) throw new Error("Weather location could not be resolved.");
  return {
    coords: { lat: Number(first.latitude), lng: Number(first.longitude), zoom: "10" },
    label: [first.name, first.admin1, first.country].filter(Boolean).join(", "),
  };
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
