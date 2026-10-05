import Icon from "@/components/Icon";
import SectionCard from "@/components/SectionCard";
import "./event.css";

export default function WaterSource({ climb }) {
  if (!climb.waterSourceNote) return null;
  return (
    <SectionCard icon="droplet" title="Water Source Information">
      <div className="event-callout">
        <div className="event-callout-title">
          <Icon name="alert" size={13} />
          Caution &mdash; Water Potability
        </div>
        <div className="event-callout-body">{climb.waterSourceNote}</div>
      </div>
    </SectionCard>
  );
}
