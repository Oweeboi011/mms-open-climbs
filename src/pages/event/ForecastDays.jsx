import LoadingSpinner from "@/components/LoadingSpinner";

export default function ForecastDays({ weather }) {
  return (
    <>
      {weather.status === "loading" ? (
        <LoadingSpinner />
      ) : weather.daily.length > 0 ? (
        <>
          {weather.locationLabel && (
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--ink-soft)",
                marginBottom: 10,
              }}
            >
              Forecast area: {weather.locationLabel}
            </p>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
              marginBottom: 14,
            }}
          >
            {weather.daily.map((day) => (
              <div
                key={day.date}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "14px 14px 12px",
                  background: "var(--surface-alt)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.74rem",
                    fontWeight: 800,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                    marginBottom: 6,
                  }}
                >
                  {day.label}
                </div>
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "var(--ink)",
                    marginBottom: 8,
                  }}
                >
                  {day.weatherLabel}
                </div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--ink-soft)",
                    lineHeight: 1.55,
                  }}
                >
                  <div>
                    Temp: {Math.round(day.minTemp)}&deg;C to{" "}
                    {Math.round(day.maxTemp)}&deg;C
                  </div>
                  <div>
                    Rain chance: {day.precipitationProbability ?? 0}%
                  </div>
                  <div>Rainfall: {day.precipitationTotal ?? 0} mm</div>
                  <div>
                    Wind: {Math.round(day.maxWindSpeed ?? 0)} km/h max
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
