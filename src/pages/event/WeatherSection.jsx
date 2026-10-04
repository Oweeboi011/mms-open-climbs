import Icon from "@/components/Icon";
import ForecastDays from "@/pages/event/ForecastDays";
import WeatherStatusNotice from "@/pages/event/WeatherStatusNotice";

export default function WeatherSection({ climb, mapCoords, weather }) {
  return (
    <>
      {/* Weather */}
      {(climb.weatherNote ||
        climb.location ||
        mapCoords ||
        climb.startDate) && (
        <div className="section-card">
          <div className="section-header">
            <span className="icon">
              <Icon name="cloudSun" size={17} />
            </span>
            <h3>Weather &amp; Forecast</h3>
          </div>
          <div className="section-body">
            {climb.weatherNote && (
              <p
                style={{
                  fontSize: "0.84rem",
                  color: "var(--ink-soft)",
                  marginBottom: 14,
                }}
              >
                {climb.weatherNote}
              </p>
            )}
            <WeatherStatusNotice weather={weather} />
            <ForecastDays weather={weather} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {weather.coords && (
                <a
                  className="btn btn-outline btn-sm"
                  href={`https://www.windy.com/${weather.coords.lat}/${weather.coords.lng}?${weather.coords.lat},${weather.coords.lng},10`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="wind" size={14} style={{ marginRight: 4 }} />
                  Windy.com
                </a>
              )}
              <a
                className="btn btn-outline btn-sm"
                href="https://www.pagasa.dost.gov.ph/weather"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="sun" size={14} style={{ marginRight: 4 }} />
                PAG-ASA Forecast
              </a>
            </div>
            <p
              style={{
                fontSize: "0.77rem",
                color: "var(--ink-soft)",
                marginTop: 12,
                lineHeight: 1.5,
                display: "flex",
                alignItems: "flex-start",
                gap: 5,
              }}
            >
              <Icon
                name="alert"
                size={13}
                color="var(--ink-soft)"
                style={{ marginTop: 2 }}
              />
              <span>
                Monitor PAG-ASA Tropical Cyclone bulletins. The climb may be
                cancelled or rescheduled due to bad weather.
              </span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
