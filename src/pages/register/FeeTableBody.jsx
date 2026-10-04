export default function FeeTableBody({
  optionalFeeSelections,
  setOptionalFeeSelections,
  required,
  optional,
}) {
  return (
    <>
      <tbody>
        {required.map((exp, i) => (
          <tr
            key={`req-${i}`}
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <td style={{ padding: "10px 0", paddingRight: 8 }}>
              <span
                style={{
                  color: "var(--green-dark)",
                  fontWeight: 800,
                  fontSize: "1rem",
                }}
              >
                ✓
              </span>
            </td>
            <td style={{ padding: "10px 0" }}>
              <div style={{ fontWeight: 600 }}>{exp.label}</div>
              {exp.note && (
                <div
                  style={{
                    fontSize: "0.74rem",
                    color: "var(--ink-soft)",
                    marginTop: 2,
                  }}
                >
                  {exp.note}
                </div>
              )}
              <div
                style={{
                  fontSize: "0.68rem",
                  color: "var(--ink-soft)",
                  marginTop: 2,
                  fontStyle: "italic",
                }}
              >
                Required
              </div>
            </td>
            <td
              style={{
                padding: "10px 0",
                textAlign: "right",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {exp.amount || "TBA"}
            </td>
          </tr>
        ))}
        {optional.map((exp, i) => {
          const checked = !!optionalFeeSelections[exp.label];
          return (
            <tr
              key={`opt-${i}`}
              style={{
                borderBottom: "1px solid var(--border)",
                background: checked
                  ? "var(--surface-alt)"
                  : "transparent",
                cursor: "pointer",
              }}
              onClick={() =>
                setOptionalFeeSelections((p) => ({
                  ...p,
                  [exp.label]: !p[exp.label],
                }))
              }
            >
              <td style={{ padding: "10px 0", paddingRight: 8 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setOptionalFeeSelections((p) => ({
                      ...p,
                      [exp.label]: !p[exp.label],
                    }))
                  }
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 16,
                    height: 16,
                    cursor: "pointer",
                  }}
                />
              </td>
              <td style={{ padding: "10px 0" }}>
                <div style={{ fontWeight: 600 }}>{exp.label}</div>
                {exp.note && (
                  <div
                    style={{
                      fontSize: "0.74rem",
                      color: "var(--ink-soft)",
                      marginTop: 2,
                    }}
                  >
                    {exp.note}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "0.68rem",
                    color: "var(--ink-soft)",
                    marginTop: 2,
                    fontStyle: "italic",
                  }}
                >
                  Optional — check if availing
                </div>
              </td>
              <td
                style={{
                  padding: "10px 0",
                  textAlign: "right",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  color: checked
                    ? "var(--ink)"
                    : "var(--ink-soft)",
                }}
              >
                {exp.amount || "TBA"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </>
  );
}
