import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import Icon from "@/components/Icon";
import { renderMarkdownLite } from "@/utils/markdownLite";

const TYPE_LABEL = {
  minor: "Minor Climb",
  major: "Major Climb",
  special: "Special Climb",
};

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

function parseGoogleMapsUrl(url) {
  if (!url) return null;
  let m = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+)z/);
  if (m) return { lat: m[1], lng: m[2], zoom: m[3] };
  m = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m) {
    const zm = url.match(/[?&]z=(\d+)/);
    return { lat: m[1], lng: m[2], zoom: zm ? zm[1] : "14" };
  }
  return null;
}

function parseGoogleMapsPlace(url) {
  if (!url) return null;
  const m = url.match(/\/maps\/place\/([^/@?]+)/);
  if (m) return decodeURIComponent(m[1].replace(/\+/g, " "));
  return null;
}

function getClimbDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function toIsoDate(date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

function formatForecastDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getWeatherLabel(code) {
  return WEATHER_CODE_LABELS[code] || "Weather update";
}

function getMapEmbed(googleMapsUrl, fallbackCoords) {
  const placeName = parseGoogleMapsPlace(googleMapsUrl);
  const parsed = parseGoogleMapsUrl(googleMapsUrl);
  const coords = parsed
    ? { lat: Number(parsed.lat), lng: Number(parsed.lng), zoom: parsed.zoom }
    : fallbackCoords || null;
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const embedSrc = placeName
    ? googleMapsApiKey
      ? `https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${encodeURIComponent(placeName)}`
      : `https://maps.google.com/maps?q=${encodeURIComponent(placeName)}&output=embed`
    : coords
      ? googleMapsApiKey
        ? `https://www.google.com/maps/embed/v1/view?key=${googleMapsApiKey}&center=${coords.lat},${coords.lng}&zoom=${coords.zoom}`
        : `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=${coords.zoom}&output=embed`
      : null;
  return { coords, embedSrc, placeName };
}

function getClimbCoords(climb) {
  if (climb?.mapLat && climb?.mapLng) {
    return {
      lat: Number(climb.mapLat),
      lng: Number(climb.mapLng),
      zoom: climb.mapZoom || "14",
    };
  }

  const parsed = parseGoogleMapsUrl(climb?.googleMapsUrl);
  return parsed
    ? { lat: Number(parsed.lat), lng: Number(parsed.lng), zoom: parsed.zoom }
    : null;
}

function LockedCard({ label, onUnlock }) {
  return (
    <button
      onClick={onUnlock}
      style={{
        width: "100%",
        textAlign: "center",
        padding: "28px 16px",
        background: "var(--surface-alt, #f8f5ee)",
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <Icon name="lock" size={30} color="var(--ink-soft)" />
      </div>
      <p
        style={{
          fontWeight: 700,
          fontSize: "0.95rem",
          marginBottom: 6,
          color: "var(--ink)",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: "0.83rem", color: "var(--ink-soft)", margin: 0 }}>
        Tap to sign in or create a free account.
      </p>
    </button>
  );
}

export default function Event() {
  const { climbId } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();

  const [climb, setClimb] = useState(null);
  const [privateInfo, setPrivateInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alreadyReg, setAlreadyReg] = useState(false);
  const [regStatus, setRegStatus] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [selectedTrailIdx, setSelectedTrailIdx] = useState(0);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [weather, setWeather] = useState({
    status: "idle",
    daily: [],
    message: "",
    coords: null,
    locationLabel: "",
  });
  const contentRef = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, "climbs", climbId));
        if (!snap.exists()) {
          navigate("/");
          return;
        }
        setClimb({ id: snap.id, ...snap.data() });

        if (currentUser) {
          try {
            const pQ = query(
              collection(db, "registrations"),
              where("climbId", "==", climbId),
              where("status", "in", ["confirmed", "pending"]),
            );
            const pSnap = await getDocs(pQ);
            setParticipants(pSnap.docs.map((d) => d.data()));
          } catch {
            setParticipants([]);
          }

          const regQ = query(
            collection(db, "registrations"),
            where("climbId", "==", climbId),
            where("userId", "==", currentUser.uid),
          );
          const regSnap = await getDocs(regQ);
          let isRegistered = false;
          if (!regSnap.empty) {
            const reg = regSnap.docs[0].data();
            if (reg.status !== "cancelled") {
              isRegistered = true;
              setAlreadyReg(true);
              setRegStatus(reg.status);
            }
          }

          // Pre-climb meeting details and resource links are registrants
          // (+ admin) only — the climbPrivate security rule enforces this
          // server-side too, so this fetch simply won't return data for
          // anyone else.
          if (isRegistered || isAdmin) {
            try {
              const privSnap = await getDoc(doc(db, "climbPrivate", climbId));
              if (privSnap.exists()) setPrivateInfo(privSnap.data());
            } catch {
              setPrivateInfo(null);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load event:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [climbId, currentUser, isAdmin, navigate]);

  useEffect(() => {
    if (!contentRef.current) return;
    const cards = contentRef.current.querySelectorAll(".section-card");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  });

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      if (!climb) return;

      const startDate = getClimbDate(climb.startDate);
      const endDate = getClimbDate(climb.endDate) || startDate;
      const climbCoords = getClimbCoords(climb);
      const locationQuery =
        parseGoogleMapsPlace(climb.googleMapsUrl) || climb.location;

      if (!startDate || !endDate) {
        setWeather({
          status: "unavailable",
          daily: [],
          message: "Weather forecast will appear once the event dates are set.",
          coords: climbCoords,
          locationLabel: climb.location || "",
        });
        return;
      }

      const today = startOfDay(new Date());
      const eventStart = startOfDay(startDate);
      const eventEnd = startOfDay(endDate);
      const forecastCutoff = new Date(today);
      forecastCutoff.setDate(forecastCutoff.getDate() + 15);
      const daysUntilStart = Math.round(
        (eventStart.getTime() - today.getTime()) / 86400000,
      );

      if (eventEnd.getTime() < today.getTime()) {
        setWeather({
          status: "unavailable",
          daily: [],
          message: "Live forecast is no longer shown for past event dates.",
          coords: climbCoords,
          locationLabel: climb.location || "",
        });
        return;
      }

      if (daysUntilStart > 15) {
        setWeather({
          status: "scheduled",
          daily: [],
          message:
            "Detailed forecast becomes available automatically within 16 days of the event start date.",
          coords: climbCoords,
          locationLabel: climb.location || "",
        });
        return;
      }

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
          const geocodeResponse = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationQuery)}&count=1&language=en&format=json`,
          );
          if (!geocodeResponse.ok)
            throw new Error("Weather location lookup failed.");
          const geocodeData = await geocodeResponse.json();
          const firstResult = geocodeData.results?.[0];
          if (!firstResult)
            throw new Error("Weather location could not be resolved.");
          resolvedCoords = {
            lat: Number(firstResult.latitude),
            lng: Number(firstResult.longitude),
            zoom: "10",
          };
          resolvedLocationLabel = [
            firstResult.name,
            firstResult.admin1,
            firstResult.country,
          ]
            .filter(Boolean)
            .join(", ");
        }

        const requestEndDate =
          eventEnd.getTime() > forecastCutoff.getTime()
            ? forecastCutoff
            : eventEnd;
        const forecastResponse = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${resolvedCoords.lat}&longitude=${resolvedCoords.lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max&timezone=auto&start_date=${toIsoDate(eventStart)}&end_date=${toIsoDate(requestEndDate)}`,
        );
        if (!forecastResponse.ok)
          throw new Error("Weather forecast request failed.");

        const forecastData = await forecastResponse.json();
        const dailyTime = forecastData.daily?.time || [];
        const dailyForecast = dailyTime.map((date, index) => ({
          date,
          label: formatForecastDate(date),
          weatherCode: forecastData.daily.weather_code?.[index],
          weatherLabel: getWeatherLabel(
            forecastData.daily.weather_code?.[index],
          ),
          maxTemp: forecastData.daily.temperature_2m_max?.[index],
          minTemp: forecastData.daily.temperature_2m_min?.[index],
          precipitationProbability:
            forecastData.daily.precipitation_probability_max?.[index],
          precipitationTotal: forecastData.daily.precipitation_sum?.[index],
          maxWindSpeed: forecastData.daily.wind_speed_10m_max?.[index],
        }));

        if (!cancelled) {
          setWeather({
            status: dailyForecast.length ? "ready" : "unavailable",
            daily: dailyForecast,
            message: dailyForecast.length
              ? requestEndDate.getTime() < eventEnd.getTime()
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

  if (loading) return <LoadingSpinner fullPage />;
  if (!climb) return null;

  const seatsLeft = climb.maxParticipants - (climb.registrationCount ?? 0);
  const isFull = seatsLeft <= 0;
  const isOpen = climb.status === "open";
  const fillPct = climb.maxParticipants
    ? Math.min(
        100,
        ((climb.registrationCount ?? 0) / climb.maxParticipants) * 100,
      )
    : 0;
  const fillClass = fillPct >= 100 ? "full" : fillPct >= 80 ? "low" : "ok";

  function RegisterButton() {
    if (!isOpen)
      return (
        <div
          className="alert alert-warning"
          style={{ marginTop: 20, display: "inline-flex" }}
        >
          Registration is currently closed for this climb.
        </div>
      );
    if (alreadyReg)
      return (
        <div
          className="alert alert-success"
          style={{ marginTop: 20, display: "inline-flex" }}
        >
          You are registered &mdash; Status:{" "}
          <strong style={{ marginLeft: 4 }}>{regStatus}</strong>
        </div>
      );
    if (isFull)
      return (
        <div
          className="alert alert-warning"
          style={{ marginTop: 20, display: "inline-flex" }}
        >
          This climb is full. Waitlist registrations may be accepted.
        </div>
      );
    if (!currentUser)
      return (
        <div
          style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}
        >
          <Link
            to={`/login?redirect=/register/${climbId}`}
            className="btn btn-gold btn-lg"
          >
            Sign In to Register
          </Link>
          <Link
            to={`/signup?redirect=/register/${climbId}`}
            className="btn btn-outline btn-lg"
          >
            Create Account
          </Link>
        </div>
      );
    return (
      <Link
        to={`/register/${climbId}`}
        className="btn btn-gold btn-lg"
        style={{ marginTop: 20, display: "inline-flex" }}
      >
        Register Now &#8594;
      </Link>
    );
  }

  const mapCoords = getClimbCoords(climb);
  const { embedSrc: mapsEmbedSrc } = getMapEmbed(climb.googleMapsUrl, mapCoords);

  // Support multiple alternate trail options (e.g. two routes up the same
  // mountain) via climb.trailMaps; fall back to the single legacy
  // googleMapsUrl/allTrailsUrl fields for climbs created before this existed.
  const trailMapEntries = climb.trailMaps?.length
    ? climb.trailMaps
    : climb.googleMapsUrl || climb.allTrailsUrl
      ? [
          {
            label: "",
            googleMapsUrl: climb.googleMapsUrl,
            allTrailsUrl: climb.allTrailsUrl,
          },
        ]
      : [];
  const activeTrailIdx = Math.min(
    selectedTrailIdx,
    Math.max(trailMapEntries.length - 1, 0),
  );
  const activeTrail = trailMapEntries[activeTrailIdx];
  const activeTrailMapEmbed = activeTrail
    ? getMapEmbed(activeTrail.googleMapsUrl, null)
    : null;

  return (
    <div>
      <Header />

      <nav className="back-nav">
        <button className="back-btn" onClick={() => navigate("/")}>
          &#8592; Back to Schedule
        </button>
      </nav>

      <section className="event-hero">
        <div className="event-hero-inner">
          <div className="event-badge">
            {TYPE_LABEL[climb.type] || climb.type}
          </div>
          <h2>
            <em>{climb.dateLabel}</em>
            {climb.title}
          </h2>
          <div className="event-meta">
            <div className="event-meta-item">
              <Icon name="calendar" size={16} />
              <span>
                <strong>{climb.dateLabel}</strong>
              </span>
            </div>
            <div className="event-meta-item">
              <Icon name="pin" size={16} />
              <span>{climb.location}</span>
            </div>
            {climb.elevation && (
              <div className="event-meta-item">
                <Icon name="mountain" size={16} />
                <span>
                  <strong>{climb.elevation} MASL</strong>
                  {climb.difficulty
                    ? ` \u2022 Difficulty ${climb.difficulty}`
                    : ""}
                </span>
              </div>
            )}
            {climb.maxParticipants && (
              <div className="event-meta-item">
                <Icon name="users" size={16} />
                <span>
                  <strong>{climb.registrationCount ?? 0}</strong> /{" "}
                  {climb.maxParticipants} slots
                </span>
              </div>
            )}
          </div>

          {climb.maxParticipants && (
            <div className="seats-bar" style={{ maxWidth: 280, marginTop: 16 }}>
              <div className="seats-bar-label">
                {isFull
                  ? "All slots filled"
                  : `${seatsLeft} slot${seatsLeft !== 1 ? "s" : ""} remaining`}
              </div>
              <div className="seats-bar-track">
                <div
                  className={`seats-bar-fill ${fillClass}`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
            </div>
          )}

          <RegisterButton />

          {!currentUser && (
            <div className="visitor-event-prompt">
              <div className="visitor-event-prompt-icon">
                <Icon name="lock" size={22} />
              </div>
              <div className="visitor-event-prompt-text">
                <strong>Sign in to access full event details</strong> — trail
                map, participant list, fees, and documents are visible to
                registered members.
              </div>
              <div className="visitor-event-prompt-actions">
                <Link
                  to={`/signup?redirect=/event/${climbId}`}
                  className="btn btn-gold"
                >
                  Create Account
                </Link>
                <Link
                  to={`/login?redirect=/event/${climbId}`}
                  className="btn btn-outline"
                >
                  Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <main className="content" ref={contentRef}>
        {/* Mountain Profile */}
        {(climb.elevation ||
          climb.difficulty ||
          climb.trailClass ||
          climb.description) && (
          <div className="section-card">
            <div className="section-header">
              <span className="icon">
                <Icon name="mountain" size={17} />
              </span>
              <h3>Mountain Profile</h3>
            </div>
            <div className="section-body">
              {(climb.elevation ||
                climb.difficulty ||
                climb.distanceToSummit ||
                climb.roundTripDistance ||
                climb.recommendedDays ||
                climb.jumpOff) && (
                <div className="stat-tiles">
                  {climb.elevation && (
                    <div className="stat-tile">
                      <div className="stat-tile-val">{climb.elevation}</div>
                      <div className="stat-tile-label">MASL</div>
                    </div>
                  )}
                  {climb.difficulty && (
                    <div className="stat-tile">
                      <div className="stat-tile-val">{climb.difficulty}</div>
                      <div className="stat-tile-label">Difficulty</div>
                    </div>
                  )}
                  {climb.trailClass && (
                    <div className="stat-tile">
                      <div className="stat-tile-val">
                        Class {climb.trailClass}
                      </div>
                      <div className="stat-tile-label">Trail Class</div>
                    </div>
                  )}
                  {climb.distanceToSummit && (
                    <div className="stat-tile">
                      <div className="stat-tile-val">
                        {climb.distanceToSummit}
                      </div>
                      <div className="stat-tile-label">Jump-off to Peak</div>
                    </div>
                  )}
                  {climb.roundTripDistance && (
                    <div className="stat-tile">
                      <div className="stat-tile-val">
                        {climb.roundTripDistance}
                      </div>
                      <div className="stat-tile-label">Round Trip</div>
                    </div>
                  )}
                  {climb.elevationGain && (
                    <div className="stat-tile stat-tile-green">
                      <div className="stat-tile-val">{climb.elevationGain}</div>
                      <div className="stat-tile-label">Elev. Gain</div>
                    </div>
                  )}
                  {climb.recommendedDays && (
                    <div className="stat-tile">
                      <div className="stat-tile-val">
                        {climb.recommendedDays}
                      </div>
                      <div className="stat-tile-label">Recommended</div>
                    </div>
                  )}
                </div>
              )}
              {(climb.jumpOff || climb.features) && (
                <div
                  style={{
                    fontSize: "0.86rem",
                    lineHeight: 1.7,
                    color: "var(--ink-soft)",
                    marginBottom: climb.description ? 12 : 0,
                  }}
                >
                  {climb.jumpOff && (
                    <>
                      <strong style={{ color: "var(--ink)" }}>Jump-off:</strong>{" "}
                      {climb.jumpOff}
                      {climb.jumpOffElevation
                        ? ` (${climb.jumpOffElevation}m)`
                        : ""}
                      <br />
                    </>
                  )}
                  {climb.features && (
                    <>
                      <strong style={{ color: "var(--ink)" }}>Features:</strong>{" "}
                      {climb.features}
                    </>
                  )}
                </div>
              )}
              {climb.description && (
                <div
                  style={{
                    fontSize: "0.86rem",
                    lineHeight: 1.7,
                    color: "var(--ink-soft)",
                    borderTop:
                      climb.jumpOff || climb.features
                        ? "1px solid rgba(0,0,0,0.06)"
                        : "none",
                    paddingTop: climb.jumpOff || climb.features ? 14 : 0,
                  }}
                >
                  {climb.description}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pre-Climb Meeting — registrants + admins only (see climbPrivate) */}
        {privateInfo?.preClimbMeetingDate && (
          <div className="section-card">
            <div className="section-header">
              <span className="icon">
                <Icon name="calendar" size={17} />
              </span>
              <h3>Pre-Climb Meeting</h3>
            </div>
            <div className="section-body">
              <div
                style={{
                  fontSize: "0.86rem",
                  lineHeight: 1.7,
                  color: "var(--ink)",
                }}
              >
                <strong>
                  {new Date(
                    `${privateInfo.preClimbMeetingDate}T00:00:00`,
                  ).toLocaleDateString("en-PH", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </strong>
                {privateInfo.preClimbMeetingTime && ` — ${privateInfo.preClimbMeetingTime}`}
                {privateInfo.preClimbMeetingLocation && (
                  <>
                    <br />
                    {privateInfo.preClimbMeetingLocation}
                  </>
                )}
              </div>
              {privateInfo.preClimbMeetingNotes && (
                <div
                  style={{
                    fontSize: "0.82rem",
                    lineHeight: 1.6,
                    color: "var(--ink-soft)",
                    marginTop: 10,
                    borderTop: "1px solid rgba(0,0,0,0.06)",
                    paddingTop: 10,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {privateInfo.preClimbMeetingNotes}
                </div>
              )}
              {(privateInfo.preClimbMeetingLink ||
                privateInfo.preClimbMeetingRecordingLink) && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 12,
                  }}
                >
                  {privateInfo.preClimbMeetingLink && (
                    <a
                      href={privateInfo.preClimbMeetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-accent btn-sm"
                    >
                      Join Meeting
                    </a>
                  )}
                  {privateInfo.preClimbMeetingRecordingLink && (
                    <a
                      href={privateInfo.preClimbMeetingRecordingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                    >
                      Watch Recording
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Climb Resources — registrants + admins only (see climbPrivate) */}
        {privateInfo?.resources?.length > 0 && (
          <div className="section-card">
            <div className="section-header">
              <span className="icon">
                <Icon name="route" size={17} />
              </span>
              <h3>Climb Resources</h3>
            </div>
            <div className="section-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {privateInfo.resources.map((res, i) => (
                  <a
                    key={i}
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: "0.86rem",
                      color: "var(--green-dark)",
                      textDecoration: "underline",
                    }}
                  >
                    {res.label || res.url}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Announcements */}
        {climb.announcements?.length > 0 && (
          <div className="section-card">
            <div className="section-header">
              <span className="icon">
                <Icon name="alert" size={17} />
              </span>
              <h3>Announcements</h3>
            </div>
            <div className="section-body">
              {[...climb.announcements]
                .sort((a, b) => {
                  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
                  return (b.createdAt || 0) - (a.createdAt || 0);
                })
                .map((note, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      padding: "10px 0",
                      borderTop: i > 0 ? "1px solid rgba(0,0,0,0.06)" : "none",
                    }}
                  >
                    {note.pinned && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 800,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          color: "var(--green-dark)",
                          background: "rgba(13,43,18,0.08)",
                          padding: "2px 8px",
                          borderRadius: 99,
                          whiteSpace: "nowrap",
                          marginTop: 2,
                        }}
                      >
                        Reminder
                      </span>
                    )}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: "0.86rem",
                          lineHeight: 1.6,
                          color: "var(--ink)",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {renderMarkdownLite(note.message)}
                      </div>
                      {note.createdAt && (
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--ink-soft)",
                            marginTop: 4,
                          }}
                        >
                          {new Date(note.createdAt).toLocaleDateString(
                            "en-PH",
                            { dateStyle: "medium" },
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Trail Map */}
        {trailMapEntries.length > 0 && (
          <div className="section-card">
            <div className="section-header">
              <span className="icon">
                <Icon name="pin" size={17} />
              </span>
              <h3>Trail Map</h3>
            </div>
            <div className="section-body">
              {!currentUser ? (
                <LockedCard
                  label="Sign in to view the trail map"
                  onUnlock={() => setShowSignInModal(true)}
                />
              ) : (
                <>
                  {trailMapEntries.length > 1 && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 14,
                      }}
                    >
                      {trailMapEntries.map((trail, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedTrailIdx(i)}
                          className={
                            i === activeTrailIdx
                              ? "btn btn-primary btn-sm"
                              : "btn btn-outline btn-sm"
                          }
                        >
                          {trail.label || `Trail ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                  {activeTrail?.allTrailsUrl ? (
                    <>
                      <iframe
                        src={
                          activeTrail.allTrailsUrl.replace(
                            "www.alltrails.com/trail/",
                            "www.alltrails.com/widget/trail/",
                          ) +
                          (activeTrail.allTrailsUrl.includes("?") ? "&" : "?") +
                          "u=m&width=100%25"
                        }
                        title="AllTrails trail map"
                        width="100%"
                        height="400"
                        style={{
                          border: "none",
                          borderRadius: 10,
                          display: "block",
                        }}
                        loading="lazy"
                        allowFullScreen
                      />
                      <p
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--ink-soft)",
                          marginTop: 8,
                        }}
                      >
                        Trail data &copy;{" "}
                        <a
                          href={activeTrail.allTrailsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--accent)" }}
                        >
                          AllTrails
                        </a>
                      </p>
                    </>
                  ) : activeTrailMapEmbed?.embedSrc ? (
                    <>
                      <iframe
                        src={activeTrailMapEmbed.embedSrc}
                        title={`${climb.title} location map`}
                        width="100%"
                        height="400"
                        style={{
                          border: "none",
                          borderRadius: 10,
                          display: "block",
                        }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          marginTop: 10,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <a
                          href={
                            activeTrail.googleMapsUrl ||
                            `https://www.google.com/maps?q=${activeTrailMapEmbed.coords.lat},${activeTrailMapEmbed.coords.lng}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline btn-sm"
                        >
                          <Icon name="globe" size={14} style={{ marginRight: 4 }} />
                        View on Google Maps
                        </a>
                      </div>
                    </>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}

        {/* Photos */}
        {climb.trailImages?.length > 0 && (
          <div className="section-card">
            <div className="section-header">
              <span className="icon">
                <Icon name="camera" size={17} />
              </span>
              <h3>Photos</h3>
            </div>
            <div className="section-body">
              {(() => {
                const imgs = climb.trailImages;
                const ci = Math.min(carouselIndex, imgs.length - 1);
                return (
                  <div style={{ marginBottom: 0 }}>
                    <div
                      style={{
                        position: "relative",
                        borderRadius: 10,
                        overflow: "hidden",
                        background: "#000",
                      }}
                    >
                      <img
                        src={imgs[ci]}
                        alt={`${climb.title} photo ${ci + 1}`}
                        onClick={() => setLightboxIndex(ci)}
                        style={{
                          width: "100%",
                          height: 340,
                          objectFit: "cover",
                          display: "block",
                          cursor: "zoom-in",
                        }}
                      />
                      {ci > 0 && (
                        <button
                          onClick={() => setCarouselIndex(ci - 1)}
                          style={{
                            position: "absolute",
                            left: 10,
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "rgba(0,0,0,0.45)",
                            border: "none",
                            color: "#fff",
                            fontSize: "1.6rem",
                            borderRadius: 99,
                            width: 40,
                            height: 40,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          &#8249;
                        </button>
                      )}
                      {ci < imgs.length - 1 && (
                        <button
                          onClick={() => setCarouselIndex(ci + 1)}
                          style={{
                            position: "absolute",
                            right: 10,
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "rgba(0,0,0,0.45)",
                            border: "none",
                            color: "#fff",
                            fontSize: "1.6rem",
                            borderRadius: 99,
                            width: 40,
                            height: 40,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          &#8250;
                        </button>
                      )}
                      <div
                        style={{
                          position: "absolute",
                          bottom: 10,
                          right: 12,
                          background: "rgba(0,0,0,0.5)",
                          color: "#fff",
                          fontSize: "0.75rem",
                          borderRadius: 99,
                          padding: "2px 10px",
                        }}
                      >
                        {ci + 1} / {imgs.length}
                      </div>
                    </div>
                    {imgs.length > 1 && (
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          marginTop: 8,
                          overflowX: "auto",
                          paddingBottom: 4,
                          scrollbarWidth: "thin",
                        }}
                      >
                        {imgs.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={`Thumbnail ${i + 1}`}
                            onClick={() => setCarouselIndex(i)}
                            style={{
                              width: 72,
                              height: 52,
                              objectFit: "cover",
                              borderRadius: 6,
                              flexShrink: 0,
                              cursor: "pointer",
                              border:
                                i === ci
                                  ? "2px solid var(--accent)"
                                  : "2px solid transparent",
                              opacity: i === ci ? 1 : 0.6,
                              transition: "opacity 0.15s, border-color 0.15s",
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Lightbox */}
        {lightboxIndex !== null && (
          <div
            onClick={() => setLightboxIndex(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" && lightboxIndex > 0)
                setLightboxIndex(lightboxIndex - 1);
              if (
                e.key === "ArrowRight" &&
                lightboxIndex < climb.trailImages.length - 1
              )
                setLightboxIndex(lightboxIndex + 1);
              if (e.key === "Escape") setLightboxIndex(null);
            }}
            tabIndex={0}
            ref={(el) => el && el.focus()}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.88)",
              zIndex: 1200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              outline: "none",
            }}
          >
            {lightboxIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(lightboxIndex - 1);
                }}
                style={{
                  position: "absolute",
                  left: 16,
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  color: "#fff",
                  fontSize: "1.8rem",
                  borderRadius: 99,
                  width: 48,
                  height: 48,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                &#8249;
              </button>
            )}
            <img
              src={climb.trailImages[lightboxIndex]}
              alt={`${climb.title} photo ${lightboxIndex + 1}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "90vw",
                maxHeight: "88vh",
                objectFit: "contain",
                borderRadius: 10,
                boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
              }}
            />
            {lightboxIndex < climb.trailImages.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(lightboxIndex + 1);
                }}
                style={{
                  position: "absolute",
                  right: 16,
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  color: "#fff",
                  fontSize: "1.8rem",
                  borderRadius: 99,
                  width: 48,
                  height: 48,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                &#8250;
              </button>
            )}
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                display: "flex",
                gap: 12,
                alignItems: "center",
              }}
            >
              <span
                style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem" }}
              >
                {lightboxIndex + 1} / {climb.trailImages.length}
              </span>
              <button
                onClick={() => setLightboxIndex(null)}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  color: "#fff",
                  fontSize: "1.2rem",
                  borderRadius: 99,
                  width: 36,
                  height: 36,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                &#x2715;
              </button>
            </div>
          </div>
        )}

        {/* Water Source */}
        {climb.waterSourceNote && (
          <div className="section-card">
            <div className="section-header">
              <span className="icon">
                <Icon name="droplet" size={17} />
              </span>
              <h3>Water Source Information</h3>
            </div>
            <div className="section-body">
              <div
                style={{
                  background: "#fff8e1",
                  borderLeft: "4px solid var(--gold)",
                  borderRadius: 10,
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-head)",
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "#7a5800",
                    marginBottom: 7,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Icon name="alert" size={13} />
                  Caution &mdash; Water Potability
                </div>
                <div
                  style={{
                    fontSize: "0.83rem",
                    color: "var(--ink)",
                    lineHeight: 1.55,
                  }}
                >
                  {climb.waterSourceNote}
                </div>
              </div>
            </div>
          </div>
        )}

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

        {/* Itinerary */}
        <div className="section-card">
          <div className="section-header">
            <span className="icon">
              <Icon name="map" size={17} />
            </span>
            <h3>Itinerary</h3>
          </div>
          <div className="section-body">
            {!currentUser ? (
              <LockedCard
                label="Sign in to view the itinerary"
                onUnlock={() => setShowSignInModal(true)}
              />
            ) : climb.itinerary?.length > 0 ? (
              climb.itinerary.map((day, i) => (
                <div className="day-block" key={i}>
                  <div className="day-label">{day.day}</div>
                  {day.entries?.map((e, j) => (
                    <div className="time-entry" key={j}>
                      <span className="time-label">{e.time}</span>
                      <span className="time-activity">{e.activity}</span>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <p
                className="tbd-note"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Icon name="clock" size={14} />
                Detailed itinerary will be available soon.
              </p>
            )}
          </div>
        </div>

        <div className="two-col">
          {/* Things to Bring */}
          <div className="section-card">
            <div className="section-header">
              <span className="icon">
                <Icon name="backpack" size={17} />
              </span>
              <h3>Things to Bring</h3>
            </div>
            <div className="section-body">
              {climb.thingsToBring?.length > 0 ? (
                <ul className="info-list">
                  {climb.thingsToBring.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                <ul className="info-list">
                  <li>Day pack / Overnight pack</li>
                  <li>Water, 2&ndash;3 litres per day</li>
                  <li>Snacks / Trail food</li>
                  <li>Packed meals</li>
                  <li>Mess kit</li>
                  <li>Sunscreen / Umbrella</li>
                  <li>Jacket (preferably rainproof)</li>
                  <li>Rain gear</li>
                  <li>Emergency blanket</li>
                  <li>Individual first aid kit</li>
                  <li>Personal toiletries</li>
                  <li>Head lamp</li>
                  <li>Camera / Mobile phone</li>
                  <li>Plastic bag / Trash bag</li>
                </ul>
              )}
            </div>
          </div>

          {/* Leave No Trace */}
          <div className="section-card">
            <div className="section-header">
              <span className="icon">
                <Icon name="leaf" size={17} />
              </span>
              <h3>Leave No Trace</h3>
            </div>
            <div className="section-body">
              <div className="lnt-header">
                <div className="lnt-badge">7</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                    Principles
                  </div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--ink-soft)",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                    }}
                  >
                    Leave No Trace
                  </div>
                </div>
              </div>
              <ul className="info-list">
                <li>Plan ahead and prepare</li>
                <li>Travel and camp on durable surfaces</li>
                <li>Dispose of waste properly</li>
                <li>Leave what you find</li>
                <li>Minimise campfire impact</li>
                <li>Respect wildlife</li>
                <li>Be considerate of other visitors</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Requirements */}
        {(climb.requiresMedicalCert || climb.requiresRegistrationForm) && (
          <div className="section-card">
            <div className="section-header">
              <span className="icon">
                <Icon name="alert" size={17} />
              </span>
              <h3>Requirements</h3>
            </div>
            <div className="section-body">
              <div
                style={{
                  background: "#fff8e1",
                  borderLeft: "4px solid var(--gold)",
                  borderRadius: 10,
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-head)",
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "#7a5800",
                    marginBottom: 7,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Icon name="alert" size={13} />
                  Required Before Registration is Confirmed
                </div>
                <ul
                  className="info-list"
                  style={{ margin: 0, fontSize: "0.86rem", color: "var(--ink)" }}
                >
                  {climb.requiresRegistrationForm && (
                    <li>Signed Climb Registration Form</li>
                  )}
                  {climb.requiresMedicalCert && (
                    <li>Valid Medical Certificate</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Fees */}
        <div className="section-card">
          <div className="section-header">
            <span className="icon">
              <Icon name="wallet" size={17} />
            </span>
            <h3>Fees</h3>
          </div>
          <div className="section-body">
            {climb.fees?.length > 0 ? (
              <>
                {climb.fees.map((fee, i) => (
                  <div className="expense-row" key={i}>
                    <div>
                      <div className="expense-label">{fee.label}</div>
                      {fee.note && (
                        <div className="expense-note">{fee.note}</div>
                      )}
                    </div>
                    <div className="expense-amount">{fee.amount || "TBA"}</div>
                  </div>
                ))}
                {(() => {
                  const memberFees = climb.fees.filter((f) => !f.isGuestFee);
                  const numericAmounts = memberFees
                    .map((f) => parseFloat(String(f.amount).replace(/,/g, "")))
                    .filter((n) => !isNaN(n));
                  if (numericAmounts.length === 0) return null;
                  const hasTBA = memberFees.some((f) =>
                    isNaN(parseFloat(String(f.amount).replace(/,/g, ""))),
                  );
                  const guestFee = climb.fees.find((f) => f.isGuestFee);
                  const total = numericAmounts.reduce((s, n) => s + n, 0);
                  return (
                    <>
                      <div className="expense-total-row">
                        <div className="expense-total-label">
                          Member Total
                          {hasTBA ? (
                            <span className="expense-total-note">
                              {" "}
                              (excl. TBA items)
                            </span>
                          ) : (
                            ""
                          )}
                        </div>
                        <div className="expense-total-amount">
                          &#8369;{total.toLocaleString()}
                        </div>
                      </div>
                      {guestFee && (
                        <div
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--ink-soft)",
                            marginTop: 6,
                            fontStyle: "italic",
                          }}
                        >
                          + &#8369;{guestFee.amount} Guest Fee for non-members
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              <>
                <div className="expense-row">
                  <div className="expense-label">Transportation</div>
                  <div className="expense-amount">TBA</div>
                </div>
                <div className="expense-row">
                  <div className="expense-label">Registration / Guide Fee</div>
                  <div className="expense-amount">TBA</div>
                </div>
                <div className="expense-row">
                  <div className="expense-label">Accommodation</div>
                  <div className="expense-amount">TBA</div>
                </div>
                <div className="expense-row">
                  <div className="expense-label">Food &amp; Meals</div>
                  <div className="expense-amount">TBA</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Climb Officers */}
        <div className="section-card">
          <div className="section-header">
            <span className="icon">
              <Icon name="users" size={17} />
            </span>
            <h3>Climb Officers</h3>
          </div>
          <div className="section-body">
            {!currentUser ? (
              <LockedCard
                label="Sign in to view the climb officers"
                onUnlock={() => setShowSignInModal(true)}
              />
            ) : climb.officers?.length > 0 ? (
              climb.officers.map((o, i) => (
                <div className="officer-row" key={i}>
                  <div>
                    <div className="officer-name">{o.name}</div>
                    <div className="officer-role">{o.role}</div>
                  </div>
                  <div className="officer-contact">{o.contact}</div>
                </div>
              ))
            ) : (
              <p className="tbd-note">
                Climb officers will be announced closer to the event date.
              </p>
            )}
          </div>
        </div>

        {/* Participants */}
        <div className="section-card">
          <div className="section-header">
            <span className="icon">
              <Icon name="activity" size={17} />
            </span>
            <h3>Participants</h3>
          </div>
          <div className="section-body">
            {!currentUser ? (
              <LockedCard
                label="Sign in to view the participant list"
                onUnlock={() => setShowSignInModal(true)}
              />
            ) : (
              (() => {
                const members = participants.filter(
                  (p) => p.memberType === "member",
                );
                const joiners = participants.filter(
                  (p) => p.memberType === "joiner",
                );
                const renderList = (list) =>
                  list.length === 0 ? (
                    <p className="tbd-note" style={{ marginBottom: 0 }}>
                      None yet.
                    </p>
                  ) : (
                    <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
                      {list.map((p, i) => (
                        <li key={i} style={{ fontSize: "0.9rem" }}>
                          {p.name}
                        </li>
                      ))}
                    </ol>
                  );
                return (
                  <>
                    {climb.officers?.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            letterSpacing: 2,
                            textTransform: "uppercase",
                            color: "var(--ink-soft)",
                            marginBottom: 8,
                          }}
                        >
                          Climbing Officers
                        </div>
                        <ol
                          style={{
                            margin: 0,
                            paddingLeft: 20,
                            lineHeight: 1.9,
                          }}
                        >
                          {climb.officers.map((o, i) => (
                            <li key={i} style={{ fontSize: "0.9rem" }}>
                              {o.name}{" "}
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--ink-soft)",
                                }}
                              >
                                ({o.role})
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    <div style={{ marginBottom: 20 }}>
                      <div
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          color: "var(--ink-soft)",
                          marginBottom: 8,
                        }}
                      >
                        MMS Members{" "}
                        <span style={{ fontWeight: 400 }}>
                          ({members.length})
                        </span>
                      </div>
                      {renderList(members)}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          color: "var(--ink-soft)",
                          marginBottom: 8,
                        }}
                      >
                        Joiners{" "}
                        <span style={{ fontWeight: 400 }}>
                          ({joiners.length})
                        </span>
                      </div>
                      {renderList(joiners)}
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>
      </main>

      <Footer />

      {/* Sign-in required modal */}
      {showSignInModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="signin-modal-title"
          onClick={() => setShowSignInModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 1300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "36px 32px 28px",
              maxWidth: 420,
              width: "100%",
              boxShadow: "0 12px 48px rgba(0,0,0,0.22)",
              textAlign: "center",
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowSignInModal(false)}
              aria-label="Close"
              style={{
                position: "absolute",
                top: 14,
                right: 16,
                background: "none",
                border: "none",
                fontSize: "1.3rem",
                cursor: "pointer",
                color: "var(--ink-soft)",
                lineHeight: 1,
              }}
            >
              &#x2715;
            </button>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Icon name="activity" size={36} color="var(--green-dark)" />
            </div>
            <h2
              id="signin-modal-title"
              style={{
                fontFamily: "var(--font-head)",
                fontSize: "1.3rem",
                marginBottom: 8,
                color: "var(--ink)",
              }}
            >
              Members Only
            </h2>
            <p
              style={{
                fontSize: "0.88rem",
                color: "var(--ink-soft)",
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              This section is only visible to registered members. Sign in or
              create a free account to view full event details and register your
              spot.
            </p>
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Link
                to={`/login?redirect=/event/${climbId}`}
                className="btn btn-gold"
                onClick={() => setShowSignInModal(false)}
              >
                Sign In
              </Link>
              <Link
                to={`/signup?redirect=/event/${climbId}`}
                className="btn btn-outline"
                onClick={() => setShowSignInModal(false)}
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
