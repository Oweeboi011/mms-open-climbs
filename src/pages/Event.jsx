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

const TYPE_LABEL = {
  minor: "Minor Climb",
  major: "Major Climb",
  special: "Special Climb",
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
      <div style={{ fontSize: "2rem", marginBottom: 8 }}>&#128274;</div>
      <p style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 6, color: "var(--ink)" }}>
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
  const { currentUser } = useAuth();

  const [climb, setClimb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alreadyReg, setAlreadyReg] = useState(false);
  const [regStatus, setRegStatus] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [showSignInModal, setShowSignInModal] = useState(false);
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
          if (!regSnap.empty) {
            const reg = regSnap.docs[0].data();
            if (reg.status !== "cancelled") {
              setAlreadyReg(true);
              setRegStatus(reg.status);
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
  }, [climbId, currentUser, navigate]);

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

  if (loading) return <LoadingSpinner fullPage />;
  if (!climb) return null;

  const seatsLeft = climb.maxParticipants - (climb.registrationCount ?? 0);
  const isFull = seatsLeft <= 0;
  const isOpen = climb.status === "open";
  const fillPct = climb.maxParticipants
    ? Math.min(100, ((climb.registrationCount ?? 0) / climb.maxParticipants) * 100)
    : 0;
  const fillClass = fillPct >= 100 ? "full" : fillPct >= 80 ? "low" : "ok";

  function RegisterButton() {
    if (!isOpen)
      return (
        <div className="alert alert-warning" style={{ marginTop: 20, display: "inline-flex" }}>
          Registration is currently closed for this climb.
        </div>
      );
    if (alreadyReg)
      return (
        <div className="alert alert-success" style={{ marginTop: 20, display: "inline-flex" }}>
          You are registered &mdash; Status:{" "}
          <strong style={{ marginLeft: 4 }}>{regStatus}</strong>
        </div>
      );
    if (isFull)
      return (
        <div className="alert alert-warning" style={{ marginTop: 20, display: "inline-flex" }}>
          This climb is full. Waitlist registrations may be accepted.
        </div>
      );
    if (!currentUser)
      return (
        <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link to={`/login?redirect=/register/${climbId}`} className="btn btn-gold btn-lg">
            Sign In to Register
          </Link>
          <Link to={`/signup?redirect=/register/${climbId}`} className="btn btn-outline btn-lg">
            Create Account
          </Link>
        </div>
      );
    return (
      <Link to={`/register/${climbId}`} className="btn btn-gold btn-lg" style={{ marginTop: 20, display: "inline-flex" }}>
        Register Now &#8594;
      </Link>
    );
  }

  const mapCoords =
    parseGoogleMapsUrl(climb.googleMapsUrl) ||
    (climb.mapLat ? { lat: climb.mapLat, lng: climb.mapLng, zoom: climb.mapZoom || "14" } : null);

  const mapsPlaceName = parseGoogleMapsPlace(climb.googleMapsUrl);
  const mapsEmbedSrc = mapsPlaceName
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapsPlaceName)}&output=embed`
    : mapCoords
      ? `https://maps.google.com/maps?q=${mapCoords.lat},${mapCoords.lng}&z=${mapCoords.zoom}&output=embed`
      : null;

  return (
    <div>
      <Header />

      <nav className="back-nav">
        <button className="back-btn" onClick={() => navigate(-1)}>
          &#8592; Back to Schedule
        </button>
      </nav>

      <section className="event-hero">
        <div className="event-hero-inner">
          <div className="event-badge">{TYPE_LABEL[climb.type] || climb.type}</div>
          <h2>
            <em>{climb.dateLabel}</em>
            {climb.title}
          </h2>
          <div className="event-meta">
            <div className="event-meta-item">
              &#128197; <span><strong>{climb.dateLabel}</strong></span>
            </div>
            <div className="event-meta-item">&#128205; <span>{climb.location}</span></div>
            {climb.elevation && (
              <div className="event-meta-item">
                &#9968;{" "}
                <span>
                  <strong>{climb.elevation} MASL</strong>
                  {climb.difficulty ? ` \u2022 Difficulty ${climb.difficulty}` : ""}
                </span>
              </div>
            )}
            {climb.maxParticipants && (
              <div className="event-meta-item">
                &#128101;{" "}
                <span>
                  <strong>{climb.registrationCount ?? 0}</strong> / {climb.maxParticipants} slots
                </span>
              </div>
            )}
          </div>

          {climb.maxParticipants && (
            <div className="seats-bar" style={{ maxWidth: 280, marginTop: 16 }}>
              <div className="seats-bar-label">
                {isFull ? "All slots filled" : `${seatsLeft} slot${seatsLeft !== 1 ? "s" : ""} remaining`}
              </div>
              <div className="seats-bar-track">
                <div className={`seats-bar-fill ${fillClass}`} style={{ width: `${fillPct}%` }} />
              </div>
            </div>
          )}

          <RegisterButton />
        </div>
      </section>

      <main className="content" ref={contentRef}>
        {/* Mountain Profile */}
        {(climb.elevation || climb.difficulty || climb.description) && (
          <div className="section-card">
            <div className="section-header">
              <span className="icon">&#9968;</span>
              <h3>Mountain Profile</h3>
            </div>
            <div className="section-body">
              {(climb.elevation || climb.difficulty || climb.distanceToSummit || climb.roundTripDistance || climb.recommendedDays || climb.jumpOff) && (
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
                  {climb.distanceToSummit && (
                    <div className="stat-tile">
                      <div className="stat-tile-val">{climb.distanceToSummit}</div>
                      <div className="stat-tile-label">Jump-off to Peak</div>
                    </div>
                  )}
                  {climb.roundTripDistance && (
                    <div className="stat-tile">
                      <div className="stat-tile-val">{climb.roundTripDistance}</div>
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
                      <div className="stat-tile-val">{climb.recommendedDays}</div>
                      <div className="stat-tile-label">Recommended</div>
                    </div>
                  )}
                </div>
              )}
              {(climb.jumpOff || climb.features) && (
                <div style={{ fontSize: "0.86rem", lineHeight: 1.7, color: "var(--ink-soft)", marginBottom: climb.description ? 12 : 0 }}>
                  {climb.jumpOff && (
                    <>
                      <strong style={{ color: "var(--ink)" }}>Jump-off:</strong>{" "}
                      {climb.jumpOff}{climb.jumpOffElevation ? ` (${climb.jumpOffElevation}m)` : ""}
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
                    borderTop: climb.jumpOff || climb.features ? "1px solid rgba(0,0,0,0.06)" : "none",
                    paddingTop: climb.jumpOff || climb.features ? 14 : 0,
                  }}
                >
                  {climb.description}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trail Map */}
        {(climb.allTrailsUrl || mapCoords || mapsEmbedSrc || climb.stravaUrl || climb.komootUrl) && (
          <div className="section-card">
            <div className="section-header">
              <span className="icon">&#128205;</span>
              <h3>Trail Map</h3>
            </div>
            <div className="section-body">
              {!currentUser ? (
                <LockedCard label="Sign in to view the trail map" onUnlock={() => setShowSignInModal(true)} />
              ) : (
                <>
                  {climb.allTrailsUrl ? (
                    <>
                      <iframe
                        src={
                          climb.allTrailsUrl.replace("www.alltrails.com/trail/", "www.alltrails.com/widget/trail/") +
                          (climb.allTrailsUrl.includes("?") ? "&" : "?") +
                          "u=m&width=100%25"
                        }
                        title="AllTrails trail map"
                        width="100%"
                        height="400"
                        style={{ border: "none", borderRadius: 10, display: "block" }}
                        loading="lazy"
                        allowFullScreen
                      />
                      <p style={{ fontSize: "0.7rem", color: "var(--ink-soft)", marginTop: 8 }}>
                        Trail data &copy;{" "}
                        <a href={climb.allTrailsUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                          AllTrails
                        </a>
                      </p>
                    </>
                  ) : mapCoords ? (
                    <>
                      <iframe
                        src={`https://maps.google.com/maps?q=${mapCoords.lat},${mapCoords.lng}&z=${mapCoords.zoom}&output=embed`}
                        title={`${climb.title} location map`}
                        width="100%"
                        height="400"
                        style={{ border: "none", borderRadius: 10, display: "block" }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <a
                          href={climb.googleMapsUrl || `https://www.google.com/maps?q=${mapCoords.lat},${mapCoords.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline btn-sm"
                        >
                          &#127758; View on Google Maps
                        </a>
                      </div>
                    </>
                  ) : null}
                  {(climb.stravaUrl || climb.komootUrl) && (
                    <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                      {climb.stravaUrl && (
                        <a href={climb.stravaUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ color: "#fc4c02", borderColor: "#fc4c02" }}>
                          &#127939; View on Strava
                        </a>
                      )}
                      {climb.komootUrl && (
                        <a href={climb.komootUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ color: "#6db33f", borderColor: "#6db33f" }}>
                          &#127748; Komoot Route
                        </a>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Photos */}
        {climb.trailImages?.length > 0 && (
          <div className="section-card">
            <div className="section-header">
              <span className="icon">&#128247;</span>
              <h3>Photos</h3>
            </div>
            <div className="section-body">
              {(() => {
                const imgs = climb.trailImages;
                const ci = Math.min(carouselIndex, imgs.length - 1);
                return (
                  <div style={{ marginBottom: 0 }}>
                    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000" }}>
                      <img
                        src={imgs[ci]}
                        alt={`${climb.title} photo ${ci + 1}`}
                        onClick={() => setLightboxIndex(ci)}
                        style={{ width: "100%", height: 340, objectFit: "cover", display: "block", cursor: "zoom-in" }}
                      />
                      {ci > 0 && (
                        <button
                          onClick={() => setCarouselIndex(ci - 1)}
                          style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.45)", border: "none", color: "#fff", fontSize: "1.6rem", borderRadius: 99, width: 40, height: 40, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          &#8249;
                        </button>
                      )}
                      {ci < imgs.length - 1 && (
                        <button
                          onClick={() => setCarouselIndex(ci + 1)}
                          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.45)", border: "none", color: "#fff", fontSize: "1.6rem", borderRadius: 99, width: 40, height: 40, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          &#8250;
                        </button>
                      )}
                      <div style={{ position: "absolute", bottom: 10, right: 12, background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: "0.75rem", borderRadius: 99, padding: "2px 10px" }}>
                        {ci + 1} / {imgs.length}
                      </div>
                    </div>
                    {imgs.length > 1 && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "thin" }}>
                        {imgs.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt={`Thumbnail ${i + 1}`}
                            onClick={() => setCarouselIndex(i)}
                            style={{ width: 72, height: 52, objectFit: "cover", borderRadius: 6, flexShrink: 0, cursor: "pointer", border: i === ci ? "2px solid var(--accent)" : "2px solid transparent", opacity: i === ci ? 1 : 0.6, transition: "opacity 0.15s, border-color 0.15s" }}
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
              if (e.key === "ArrowLeft" && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
              if (e.key === "ArrowRight" && lightboxIndex < climb.trailImages.length - 1) setLightboxIndex(lightboxIndex + 1);
              if (e.key === "Escape") setLightboxIndex(null);
            }}
            tabIndex={0}
            ref={(el) => el && el.focus()}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", outline: "none" }}
          >
            {lightboxIndex > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
                style={{ position: "absolute", left: 16, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: "1.8rem", borderRadius: 99, width: 48, height: 48, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                &#8249;
              </button>
            )}
            <img
              src={climb.trailImages[lightboxIndex]}
              alt={`${climb.title} photo ${lightboxIndex + 1}`}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "90vw", maxHeight: "88vh", objectFit: "contain", borderRadius: 10, boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}
            />
            {lightboxIndex < climb.trailImages.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
                style={{ position: "absolute", right: 16, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: "1.8rem", borderRadius: 99, width: 48, height: 48, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                &#8250;
              </button>
            )}
            <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem" }}>
                {lightboxIndex + 1} / {climb.trailImages.length}
              </span>
              <button
                onClick={() => setLightboxIndex(null)}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", fontSize: "1.2rem", borderRadius: 99, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
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
              <span className="icon">&#128167;</span>
              <h3>Water Source Information</h3>
            </div>
            <div className="section-body">
              <div style={{ background: "#fff8e1", borderLeft: "4px solid var(--gold)", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontFamily: "var(--font-head)", fontSize: "0.7rem", fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#7a5800", marginBottom: 7 }}>
                  &#9888; Caution &mdash; Water Potability
                </div>
                <div style={{ fontSize: "0.83rem", color: "var(--ink)", lineHeight: 1.55 }}>
                  {climb.waterSourceNote}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Weather */}
        {(climb.weatherNote || climb.mapLat) && (
          <div className="section-card">
            <div className="section-header">
              <span className="icon">&#127780;</span>
              <h3>Weather &amp; Forecast</h3>
            </div>
            <div className="section-body">
              {climb.weatherNote && (
                <p style={{ fontSize: "0.84rem", color: "var(--ink-soft)", marginBottom: 14 }}>
                  {climb.weatherNote}
                </p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {climb.mapLat && (
                  <a className="btn btn-outline btn-sm" href={`https://www.windy.com/${climb.mapLat}/${climb.mapLng}?${climb.mapLat},${climb.mapLng},10`} target="_blank" rel="noopener noreferrer">
                    &#127788; Windy.com
                  </a>
                )}
                <a className="btn btn-outline btn-sm" href="https://www.pagasa.dost.gov.ph/weather" target="_blank" rel="noopener noreferrer">
                  &#127782; PAG-ASA Forecast
                </a>
              </div>
              <p style={{ fontSize: "0.77rem", color: "var(--ink-soft)", marginTop: 12, lineHeight: 1.5 }}>
                &#9888; Monitor PAG-ASA Tropical Cyclone bulletins. The climb may be cancelled or rescheduled due to bad weather.
              </p>
            </div>
          </div>
        )}

        {/* Itinerary */}
        <div className="section-card">
          <div className="section-header">
            <span className="icon">&#128506;</span>
            <h3>Itinerary</h3>
          </div>
          <div className="section-body">
            {!currentUser ? (
              <LockedCard label="Sign in to view the itinerary" onUnlock={() => setShowSignInModal(true)} />
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
              <p className="tbd-note">&#128337; Detailed itinerary will be available soon.</p>
            )}
          </div>
        </div>

        <div className="two-col">
          {/* Things to Bring */}
          <div className="section-card">
            <div className="section-header">
              <span className="icon">&#127890;</span>
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
              <span className="icon">&#127807;</span>
              <h3>Leave No Trace</h3>
            </div>
            <div className="section-body">
              <div className="lnt-header">
                <div className="lnt-badge">7</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Principles</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--ink-soft)", letterSpacing: 1, textTransform: "uppercase" }}>Leave No Trace</div>
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

        {/* Expenses */}
        <div className="section-card">
          <div className="section-header">
            <span className="icon">&#128176;</span>
            <h3>Estimated Expenses</h3>
          </div>
          <div className="section-body">
            {climb.expenses?.length > 0 ? (
              <>
                {climb.expenses.map((exp, i) => (
                  <div className="expense-row" key={i}>
                    <div>
                      <div className="expense-label">{exp.label}</div>
                      {exp.note && <div className="expense-note">{exp.note}</div>}
                    </div>
                    <div className="expense-amount">{exp.amount || "TBA"}</div>
                  </div>
                ))}
                {(() => {
                  const memberExpenses = climb.expenses.filter((e) => !/guest/i.test(e.label));
                  const numericAmounts = memberExpenses.map((e) => parseFloat(String(e.amount).replace(/,/g, ""))).filter((n) => !isNaN(n));
                  if (numericAmounts.length === 0) return null;
                  const hasTBA = memberExpenses.some((e) => isNaN(parseFloat(String(e.amount).replace(/,/g, ""))));
                  const guestFee = climb.expenses.find((e) => /guest/i.test(e.label));
                  const total = numericAmounts.reduce((s, n) => s + n, 0);
                  return (
                    <>
                      <div className="expense-total-row">
                        <div className="expense-total-label">
                          Member Total
                          {hasTBA ? <span className="expense-total-note"> (excl. TBA items)</span> : ""}
                        </div>
                        <div className="expense-total-amount">&#8369;{total.toLocaleString()}</div>
                      </div>
                      {guestFee && (
                        <div style={{ fontSize: "0.72rem", color: "var(--ink-soft)", marginTop: 6, fontStyle: "italic" }}>
                          + &#8369;{guestFee.amount} Guest Fee for non-members
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              <>
                <div className="expense-row"><div className="expense-label">Transportation</div><div className="expense-amount">TBA</div></div>
                <div className="expense-row"><div className="expense-label">Registration / Guide Fee</div><div className="expense-amount">TBA</div></div>
                <div className="expense-row"><div className="expense-label">Accommodation</div><div className="expense-amount">TBA</div></div>
                <div className="expense-row"><div className="expense-label">Food &amp; Meals</div><div className="expense-amount">TBA</div></div>
              </>
            )}
          </div>
        </div>

        {/* Climb Officers */}
        <div className="section-card">
          <div className="section-header">
            <span className="icon">&#128101;</span>
            <h3>Climb Officers</h3>
          </div>
          <div className="section-body">
            {!currentUser ? (
              <LockedCard label="Sign in to view the climb officers" onUnlock={() => setShowSignInModal(true)} />
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
              <p className="tbd-note">Climb officers will be announced closer to the event date.</p>
            )}
          </div>
        </div>

        {/* Participants */}
        <div className="section-card">
          <div className="section-header">
            <span className="icon">&#127939;</span>
            <h3>Participants</h3>
          </div>
          <div className="section-body">
            {!currentUser ? (
              <LockedCard label="Sign in to view the participant list" onUnlock={() => setShowSignInModal(true)} />
            ) : (
              (() => {
                const members = participants.filter((p) => p.memberType === "member");
                const joiners = participants.filter((p) => p.memberType === "joiner");
                const renderList = (list) =>
                  list.length === 0 ? (
                    <p className="tbd-note" style={{ marginBottom: 0 }}>None yet.</p>
                  ) : (
                    <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
                      {list.map((p, i) => (
                        <li key={i} style={{ fontSize: "0.9rem" }}>{p.name}</li>
                      ))}
                    </ol>
                  );
                return (
                  <>
                    {climb.officers?.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 8 }}>
                          Climbing Officers
                        </div>
                        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
                          {climb.officers.map((o, i) => (
                            <li key={i} style={{ fontSize: "0.9rem" }}>
                              {o.name}{" "}
                              <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>({o.role})</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 8 }}>
                        MMS Members <span style={{ fontWeight: 400 }}>({members.length})</span>
                      </div>
                      {renderList(members)}
                    </div>
                    <div>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 8 }}>
                        Joiners <span style={{ fontWeight: 400 }}>({joiners.length})</span>
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
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: "36px 32px 28px", maxWidth: 420, width: "100%", boxShadow: "0 12px 48px rgba(0,0,0,0.22)", textAlign: "center", position: "relative" }}
          >
            <button
              onClick={() => setShowSignInModal(false)}
              aria-label="Close"
              style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "var(--ink-soft)", lineHeight: 1 }}
            >
              &#x2715;
            </button>
            <div style={{ fontSize: "2.4rem", marginBottom: 12 }}>&#127939;</div>
            <h2
              id="signin-modal-title"
              style={{ fontFamily: "var(--font-head)", fontSize: "1.3rem", marginBottom: 8, color: "var(--ink)" }}
            >
              Members Only
            </h2>
            <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 24 }}>
              This section is only visible to registered members. Sign in or create a free account to view full event details and register your spot.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <Link to={`/login?redirect=/event/${climbId}`} className="btn btn-gold" onClick={() => setShowSignInModal(false)}>
                Sign In
              </Link>
              <Link to={`/signup?redirect=/event/${climbId}`} className="btn btn-outline" onClick={() => setShowSignInModal(false)}>
                Create Account
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
