import { TRAIL_CLASS_LABELS, getExperienceLevel } from "@/utils/trailClass";

export default function ClimbRatingCells({ climb }) {
  const level = getExperienceLevel(climb);
  const trailClassText = climb.trailClass
    ? `Class ${climb.trailClass}${
        TRAIL_CLASS_LABELS[climb.trailClass]
          ? ` · ${TRAIL_CLASS_LABELS[climb.trailClass]}`
          : ""
      }`
    : null;
  const detail = [trailClassText, climb.difficulty && `${climb.difficulty} Difficulty`]
    .filter(Boolean)
    .join(" · ");

  return (
    <td>
      <span
        style={{
          display: "inline-block",
          fontSize: "0.62rem",
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          padding: "2px 8px",
          borderRadius: 20,
          background: `${level.color}1a`,
          color: level.color,
          border: `1px solid ${level.color}55`,
          whiteSpace: "nowrap",
        }}
      >
        {level.label}
      </span>
      {detail && (
        <div
          style={{
            fontSize: "0.68rem",
            color: "var(--ink-soft)",
            marginTop: 3,
          }}
        >
          {detail}
        </div>
      )}
    </td>
  );
}
