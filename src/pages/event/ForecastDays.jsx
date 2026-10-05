import LoadingSpinner from "@/components/LoadingSpinner";
import "./event.css";

export default function ForecastDays({ weather }) {
  if (weather.status === "loading") return <LoadingSpinner />;
  if (weather.daily.length === 0) return null;
  return (
    <>
      {weather.locationLabel && <p className="forecast-area">Forecast area: {weather.locationLabel}</p>}
      <div className="forecast-grid">
        {weather.daily.map((day) => (
          <div key={day.date} className="forecast-day">
            <div className="forecast-day-label">{day.label}</div>
            <div className="forecast-day-weather">{day.weatherLabel}</div>
            <div className="forecast-day-stats">
              <div>
                Temp: {Math.round(day.minTemp)}&deg;C to {Math.round(day.maxTemp)}&deg;C
              </div>
              <div>Rain chance: {day.precipitationProbability ?? 0}%</div>
              <div>Rainfall: {day.precipitationTotal ?? 0} mm</div>
              <div>Wind: {Math.round(day.maxWindSpeed ?? 0)} km/h max</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
