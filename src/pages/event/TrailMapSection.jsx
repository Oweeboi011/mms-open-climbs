import Icon from "@/components/Icon";
import SectionCard from "@/components/SectionCard";
import LockedCard from "@/pages/event/LockedCard";
import TrailEmbed from "@/pages/event/TrailEmbed";
import "./event.css";

function TrailTabs({ entries, activeIdx, onSelect }) {
  if (entries.length < 2) return null;
  return (
    <div className="trail-tabs">
      {entries.map((trail, i) => (
        <button
          key={i}
          type="button"
          aria-pressed={i === activeIdx}
          onClick={() => onSelect(i)}
          className={i === activeIdx ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
        >
          {trail.label || `Trail ${i + 1}`}
        </button>
      ))}
    </div>
  );
}

function GoogleMap({ climb, trail, embed }) {
  const href = trail.googleMapsUrl || `https://www.google.com/maps?q=${embed.coords.lat},${embed.coords.lng}`;
  return (
    <div className="trail-embed-block">
      <iframe
        className="trail-frame"
        src={embed.embedSrc}
        title={`${climb.title} location map`}
        width="100%"
        height="400"
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="trail-frame-actions">
        <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
          <Icon name="globe" size={14} className="trail-link-icon" />
          View on Google Maps
        </a>
      </div>
    </div>
  );
}

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
  if (trailMapEntries.length === 0) return null;
  if (!currentUser) {
    return (
      <SectionCard icon="pin" title="Trail Map">
        <LockedCard label="Sign in to view the trail map" onUnlock={() => setShowSignInModal(true)} />
      </SectionCard>
    );
  }
  let map = null;
  if (allTrailsEmbed) {
    map = <TrailEmbed embed={allTrailsEmbed} title="AllTrails trail map" height="400" source="AllTrails" />;
  } else if (activeTrailMapEmbed?.embedSrc) {
    map = <GoogleMap climb={climb} trail={activeTrail} embed={activeTrailMapEmbed} />;
  }
  return (
    <SectionCard icon="pin" title="Trail Map">
      <TrailTabs entries={trailMapEntries} activeIdx={activeTrailIdx} onSelect={setSelectedTrailIdx} />
      {map}
      <TrailEmbed embed={komootEmbed} title="Komoot route map" height="700" source="Komoot" />
    </SectionCard>
  );
}
