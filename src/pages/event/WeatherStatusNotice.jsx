import Icon from "@/components/Icon";

// Shown when no forecast cards are available.
export default function WeatherStatusNotice({ weather }) {
  return (
    <>
      {/* Status notice — shown when no forecast cards are available */}
      {weather.status !== "loading" &&
        weather.status !== "idle" &&
        weather.daily.length === 0 && (
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              background:
                weather.status === "error"
                  ? "var(--surface-warning, #fff8e1)"
                  : "var(--surface-alt, #f8f5ee)",
              border: `1px solid ${
                weather.status === "error"
                  ? "var(--warning-border, #ffe082)"
                  : "var(--border, #e0dbd0)"
              }`,
              borderRadius: 10,
              padding: "14px 16px",
              marginBottom: 14,
            }}
          >
            <span style={{ flexShrink: 0 }}>
              <Icon
                name={
                  weather.status === "error"
                    ? "alert"
                    : weather.status === "past" ||
                        weather.status === "unavailable"
                      ? "calendar"
                      : "clock"
                }
                size={19}
                color={
                  weather.status === "error"
                    ? "#b45309"
                    : "var(--ink-soft)"
                }
              />
            </span>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  color: "var(--ink)",
                  marginBottom: 3,
                }}
              >
                {weather.status === "scheduled" &&
                  "Forecast not yet available"}
                {weather.status === "unavailable" &&
                  "Forecast unavailable"}
                {weather.status === "error" &&
                  "Could not load forecast"}
              </div>
              <div
                style={{
                  fontSize: "0.83rem",
                  color: "var(--ink-soft)",
                  lineHeight: 1.5,
                }}
              >
                {weather.locationLabel
                  ? `${weather.locationLabel} — `
                  : ""}
                {weather.message}
              </div>
            </div>
          </div>
        )}
    </>
  );
}
