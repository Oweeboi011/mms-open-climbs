import Icon from "@/components/Icon";

export default function WaterSource({ climb }) {
  return (
    <>
      {/* Water Source */}
      {climb.waterSourceNote && (
        <div className="section-card">
          <div className="section-header">
            <span className="icon">
              <Icon name="droplet" size={17} />
            </span>
            <h3>Water Source Information</h3>
          </div>
          <div className="section-body">
            <div
              style={{
                background: "#fff8e1",
                borderLeft: "4px solid var(--gold)",
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-head)",
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "#7a5800",
                  marginBottom: 7,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Icon name="alert" size={13} />
                Caution &mdash; Water Potability
              </div>
              <div
                style={{
                  fontSize: "0.83rem",
                  color: "var(--ink)",
                  lineHeight: 1.55,
                }}
              >
                {climb.waterSourceNote}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
