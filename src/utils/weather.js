const WEATHER_CODE_LABELS = {
  0: "Clear skies",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Heavy freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Heavy rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorms",
  96: "Thunderstorms with hail",
  99: "Severe thunderstorms",
};

function getClimbDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Climb days are Philippine calendar days. Working them out in the viewer's
// own time zone (then converting to UTC) asked Open-Meteo for the day before
// the climb in Manila, and for other days again elsewhere.
const CLIMB_TIME_ZONE = "Asia/Manila";
const ISO_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLIMB_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// "YYYY-MM-DD" for the Philippine calendar day this moment falls on.
function toIsoDate(date) {
  return ISO_DAY.format(date);
}

const dayNumber = (isoDate) => Date.parse(`${isoDate}T00:00:00Z`) / 86400000;

function addDays(isoDate, days) {
  return new Date((dayNumber(isoDate) + days) * 86400000).toISOString().slice(0, 10);
}

export function formatForecastDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function getWeatherLabel(code) {
  return WEATHER_CODE_LABELS[code] || "Weather update";
}


// Open-Meteo forecasts 16 days out (today + 15).
const FORECAST_DAYS_AHEAD = 15;

// Whether a forecast can be shown for these event dates, and over which
// window. Returns `{ status, message }` when it can't, or the days to
// request ("YYYY-MM-DD", Philippine time) when it can.
export function planForecast(startValue, endValue, now = new Date()) {
  const startDate = getClimbDate(startValue);
  const endDate = getClimbDate(endValue) || startDate;
  if (!startDate || !endDate) {
    return { status: "unavailable", message: "Weather forecast will appear once the event dates are set." };
  }
  const today = toIsoDate(now);
  const eventStart = toIsoDate(startDate);
  const eventEnd = toIsoDate(endDate);
  if (eventEnd < today) {
    return { status: "unavailable", message: "Live forecast is no longer shown for past event dates." };
  }
  if (dayNumber(eventStart) - dayNumber(today) > FORECAST_DAYS_AHEAD) {
    return {
      status: "scheduled",
      message:
        "Detailed forecast becomes available automatically within 16 days of the event start date.",
    };
  }
  const cutoff = addDays(today, FORECAST_DAYS_AHEAD);
  return {
    eventStart,
    requestEnd: eventEnd > cutoff ? cutoff : eventEnd,
    truncated: eventEnd > cutoff,
  };
}
