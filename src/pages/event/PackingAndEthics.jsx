import SectionCard from "@/components/SectionCard";
import "./event.css";

const DEFAULT_PACKING = [
  "Day pack / Overnight pack",
  "Water, 2–3 litres per day",
  "Snacks / Trail food",
  "Packed meals",
  "Mess kit",
  "Sunscreen / Umbrella",
  "Jacket (preferably rainproof)",
  "Rain gear",
  "Emergency blanket",
  "Individual first aid kit",
  "Personal toiletries",
  "Head lamp",
  "Camera / Mobile phone",
  "Plastic bag / Trash bag",
];

const LEAVE_NO_TRACE = [
  "Plan ahead and prepare",
  "Travel and camp on durable surfaces",
  "Dispose of waste properly",
  "Leave what you find",
  "Minimise campfire impact",
  "Respect wildlife",
  "Be considerate of other visitors",
];

// Things to bring and Leave No Trace.
export default function PackingAndEthics({ climb }) {
  const packing = climb.thingsToBring?.length > 0 ? climb.thingsToBring : DEFAULT_PACKING;
  return (
    <div className="two-col">
      <SectionCard icon="backpack" title="Things to Bring">
        <ul className="info-list">
          {packing.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard icon="leaf" title="Leave No Trace">
        <div className="lnt-header">
          <div className="lnt-badge">7</div>
          <div>
            <div className="lnt-title">Principles</div>
            <div className="lnt-subtitle">Leave No Trace</div>
          </div>
        </div>
        <ul className="info-list">
          {LEAVE_NO_TRACE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
