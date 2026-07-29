// Small pieces shared between ClimbDetail.jsx and its extracted
// RegistrantRow component: status label/style maps and two tiny display
// components. Kept out of both files to avoid a circular import between the
// page and the row component.

export const EXPERIENCE_LABELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  experienced: "Experienced",
};

export const STATUS_OPTIONS = ["pending", "confirmed", "waitlisted", "cancelled"];

export const STATUS_STYLE = {
  pending: { bg: "#fff8e1", color: "#b45309", border: "#fde68a" },
  confirmed: { bg: "#e8f5e9", color: "#1a6b2c", border: "#a7d7b2" },
  waitlisted: { bg: "#fff3e0", color: "#c05c00", border: "#ffd399" },
  cancelled: { bg: "#fce8e8", color: "#b91c1c", border: "#fca5a5" },
};

export const PAYMENT_STYLE = {
  submitted: {
    bg: "#fff8e1",
    color: "#b45309",
    border: "#fde68a",
    label: "Submitted",
  },
  verified: {
    bg: "#e8f5e9",
    color: "#1a6b2c",
    border: "#a7d7b2",
    label: "Verified",
  },
  rejected: {
    bg: "#fce8e8",
    color: "#b91c1c",
    border: "#fca5a5",
    label: "Rejected",
  },
};

export function StatusBadge({ status, styleMap }) {
  const s = styleMap?.[status];
  if (!s)
    return (
      <span style={{ color: "var(--ink-soft)", fontSize: "0.75rem" }}>—</span>
    );
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: "0.72rem",
        fontWeight: 700,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {s.label || status}
    </span>
  );
}

export function InfoCell({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div
        style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--ink-soft)",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "0.85rem" }}>{value}</div>
    </div>
  );
}
