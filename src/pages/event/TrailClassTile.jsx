import { TRAIL_CLASS_DESCRIPTIONS, TRAIL_CLASS_LABELS } from "@/utils/trailClass";

export default function TrailClassTile({ trailClass }) {
  return (
    <div
      className="stat-tile"
      title={TRAIL_CLASS_DESCRIPTIONS[trailClass] || ""}
    >
      <div className="stat-tile-val">Class {trailClass}</div>
      <div className="stat-tile-label">
        {TRAIL_CLASS_LABELS[trailClass] || "Trail Class"}
      </div>
    </div>
  );
}
