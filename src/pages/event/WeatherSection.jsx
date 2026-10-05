import Icon from "@/components/Icon";
import SectionCard from "@/components/SectionCard";
import ForecastDays from "@/pages/event/ForecastDays";
import WeatherStatusNotice from "@/pages/event/WeatherStatusNotice";
import "./event.css";

export default function WeatherSection({ climb, mapCoords, weather }) {
  if (!(climb.weatherNote || climb.location || mapCoords || climb.startDate)) return null;
  const { coords } = weather;
  return (
    <SectionCard icon="cloudSun" title="Weather & Forecast">
      {climb.weatherNote && <p className="event-lead">{climb.weatherNote}</p>}
      <WeatherStatusNotice weather={weather} />
      <ForecastDays weather={weather} />
      <div className="weather-links">
        {coords && (
          <a
            className="btn btn-outline btn-sm"
            href={`https://www.windy.com/${coords.lat}/${coords.lng}?${coords.lat},${coords.lng},10`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="wind" size={14} className="weather-link-icon" />
            Windy.com
          </a>
        )}
        <a
          className="btn btn-outline btn-sm"
          href="https://www.pagasa.dost.gov.ph/weather"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="sun" size={14} className="weather-link-icon" />
          PAG-ASA Forecast
        </a>
      </div>
      <p className="weather-caveat">
        <Icon name="alert" size={13} color="var(--ink-soft)" className="weather-caveat-icon" />
        <span>
          Monitor PAG-ASA Tropical Cyclone bulletins. The climb may be cancelled or rescheduled due to bad weather.
        </span>
      </p>
    </SectionCard>
  );
}
