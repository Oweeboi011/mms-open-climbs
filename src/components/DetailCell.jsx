export default function DetailCell({ label, value }) {
  return (
    <div>
      <div
        style={{
          fontSize: "0.6rem",
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "var(--ink-soft)",
          marginBottom: 1,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "0.78rem" }}>
        {value || <span style={{ color: "var(--ink-soft)" }}>Not set</span>}
      </div>
    </div>
  );
}
