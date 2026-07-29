// Shared small display piece between ManagePayments.jsx and its extracted
// ClimbPaymentCard component.
export function StatBox({ label, value, sub, color }) {
  return (
    <div
      style={{
        flex: "1 1 120px",
        padding: "14px 16px",
        borderRadius: 10,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          fontSize: "1.4rem",
          fontWeight: 900,
          color: color || "var(--ink)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--ink-soft)",
          marginTop: 2,
        }}
      >
        {label}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "0.72rem",
            color: "var(--ink-soft)",
            marginTop: 3,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
