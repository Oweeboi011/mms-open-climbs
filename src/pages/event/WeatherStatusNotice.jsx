import Icon from "@/components/Icon";
import "./event.css";

const TITLES = {
  scheduled: "Forecast not yet available",
  unavailable: "Forecast unavailable",
  error: "Could not load forecast",
};

function iconFor(status) {
  if (status === "error") return "alert";
  return status === "past" || status === "unavailable" ? "calendar" : "clock";
}

// Shown when no forecast cards are available.
export default function WeatherStatusNotice({ weather }) {
  const { status } = weather;
  if (status === "loading" || status === "idle" || weather.daily.length > 0) return null;
  const isError = status === "error";
  return (
    <div className={isError ? "weather-status weather-status--error" : "weather-status"}>
      <span className="weather-status-icon">
        <Icon name={iconFor(status)} size={19} color={isError ? "var(--warning-ink)" : "var(--ink-soft)"} />
      </span>
      <div>
        <div className="weather-status-title">{TITLES[status]}</div>
        <div className="weather-status-text">
          {weather.locationLabel ? `${weather.locationLabel} — ` : ""}
          {weather.message}
        </div>
      </div>
    </div>
  );
}
