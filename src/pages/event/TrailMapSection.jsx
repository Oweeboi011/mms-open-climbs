import Icon from "@/components/Icon";
import LockedCard from "@/pages/event/LockedCard";
import TrailEmbed from "@/pages/event/TrailEmbed";

export default function TrailMapSection({
  activeTrail,
  activeTrailIdx,
  activeTrailMapEmbed,
  allTrailsEmbed,
  climb,
  currentUser,
  komootEmbed,
  setSelectedTrailIdx,
  setShowSignInModal,
  trailMapEntries,
}) {
  return (
    <>
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
                {allTrailsEmbed ? (
                  <TrailEmbed
                    embed={allTrailsEmbed}
                    title="AllTrails trail map"
                    height="400"
                    source="AllTrails"
                  />
                ) : activeTrailMapEmbed?.embedSrc ? (
                  <div className="trail-embed-block">
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
                        <Icon
                          name="globe"
                          size={14}
                          style={{ marginRight: 4 }}
                        />
                        View on Google Maps
                      </a>
                    </div>
                  </div>
                ) : null}
                <TrailEmbed
                  embed={komootEmbed}
                  title="Komoot route map"
                  height="700"
                  source="Komoot"
                />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
