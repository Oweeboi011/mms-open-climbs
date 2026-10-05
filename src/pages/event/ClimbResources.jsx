import SectionCard from "@/components/SectionCard";
import "./event.css";

// Registrants + admins only (see climbPrivate).
export default function ClimbResources({ privateInfo }) {
  if (!privateInfo?.resources?.length) return null;
  return (
    <SectionCard icon="route" title="Climb Resources">
      <p className="event-lead">
        Links you&apos;ll need for this climb — trackers, shared sheets, packing lists, and other post-climb resources.
      </p>
      <div className="resource-links">
        {privateInfo.resources.map((res, i) => (
          <a key={i} className="resource-link" href={res.url} target="_blank" rel="noopener noreferrer">
            {res.label || res.url}
          </a>
        ))}
      </div>
    </SectionCard>
  );
}
