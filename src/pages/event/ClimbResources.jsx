import Icon from "@/components/Icon";

// Registrants + admins only (see climbPrivate).
export default function ClimbResources({ privateInfo }) {
  return (
    <>
      {/* Climb Resources — registrants + admins only (see climbPrivate) */}
      {privateInfo?.resources?.length > 0 && (
        <div className="section-card">
          <div className="section-header">
            <span className="icon">
              <Icon name="route" size={17} />
            </span>
            <h3>Climb Resources</h3>
          </div>
          <div className="section-body">
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--ink-soft)",
                marginBottom: 14,
              }}
            >
              Links you'll need for this climb — trackers, shared sheets,
              packing lists, and other post-climb resources.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {privateInfo.resources.map((res, i) => (
                <a
                  key={i}
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "0.86rem",
                    color: "var(--green-dark)",
                    textDecoration: "underline",
                  }}
                >
                  {res.label || res.url}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
