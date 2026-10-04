import Icon from "@/components/Icon";
import MountainStats from "@/pages/event/MountainStats";

export default function MountainProfile({ climb }) {
  return (
    <>
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
            <MountainStats climb={climb} />
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
    </>
  );
}
