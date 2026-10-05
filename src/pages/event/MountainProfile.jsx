import SectionCard from "@/components/SectionCard";
import MountainStats from "@/pages/event/MountainStats";
import "./event.css";

export default function MountainProfile({ climb }) {
  if (!(climb.elevation || climb.difficulty || climb.trailClass || climb.description)) return null;
  return (
    <SectionCard icon="mountain" title="Mountain Profile">
      <MountainStats climb={climb} />
      {(climb.jumpOff || climb.features) && (
        <div className="event-prose">
          {climb.jumpOff && (
            <>
              <strong>Jump-off:</strong> {climb.jumpOff}
              {climb.jumpOffElevation ? ` (${climb.jumpOffElevation}m)` : ""}
              <br />
            </>
          )}
          {climb.features && (
            <>
              <strong>Features:</strong> {climb.features}
            </>
          )}
        </div>
      )}
      {climb.description && <div className="event-prose">{climb.description}</div>}
    </SectionCard>
  );
}
