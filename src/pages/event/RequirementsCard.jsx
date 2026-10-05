import Icon from "@/components/Icon";
import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";

export default function RequirementsCard({ climb }) {
  return (
    <>
      {/* Requirements */}
      {REQUIRED_DOC_TYPES.some((docType) => climb[docType.requiresField]) && (
        <div className="section-card">
          <div className="section-header">
            <span className="icon">
              <Icon name="alert" size={17} />
            </span>
            <h3>Requirements</h3>
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
                Required Before Climb Day
              </div>
              <ul
                className="info-list"
                style={{
                  margin: 0,
                  fontSize: "0.86rem",
                  color: "var(--ink)",
                }}
              >
                {REQUIRED_DOC_TYPES.filter(
                  (docType) => climb[docType.requiresField],
                ).map((docType) => (
                  <li key={docType.key}>
                    {docType.requirementLabel}
                    {climb[docType.sampleUrlField] && (
                      <>
                        {" — "}
                        <a
                          href={climb[docType.sampleUrlField]}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          &#128196; {docType.downloadButtonLabel}
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
