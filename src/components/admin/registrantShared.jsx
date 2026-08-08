// Small pieces shared between ClimbDetail.jsx and its extracted
// RegistrantRow component: status label/style maps and two tiny display
// components. Kept out of both files to avoid a circular import between the
// page and the row component.

export const EXPERIENCE_LABELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  experienced: "Experienced",
};

export const STATUS_OPTIONS = [
  "pending",
  "confirmed",
  "waitlisted",
  "cancelled",
];

export const STATUS_STYLE = {
  pending: {
    bg: "#fff8e1",
    color: "#b45309",
    border: "#fde68a",
    icon: "\u25CB",
  },
  confirmed: {
    bg: "#e8f5e9",
    color: "#1a6b2c",
    border: "#a7d7b2",
    icon: "\u2713",
  },
  waitlisted: {
    bg: "#fff3e0",
    color: "#c05c00",
    border: "#ffd399",
    icon: "\u23F3",
  },
  cancelled: {
    bg: "#fce8e8",
    color: "#b91c1c",
    border: "#fca5a5",
    icon: "\u2715",
  },
};

export const PAYMENT_STYLE = {
  unpaid: {
    bg: "#f3f4f6",
    color: "#6b7280",
    border: "#d1d5db",
    label: "Unpaid",
    icon: "\u25CB",
  },
  submitted: {
    bg: "#fff8e1",
    color: "#b45309",
    border: "#fde68a",
    label: "Submitted",
    icon: "\u2709",
  },
  verified: {
    bg: "#e8f5e9",
    color: "#1a6b2c",
    border: "#a7d7b2",
    label: "Verified",
    icon: "\u2713",
  },
  rejected: {
    bg: "#fce8e8",
    color: "#b91c1c",
    border: "#fca5a5",
    label: "Rejected",
    icon: "\u2715",
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
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: "0.68rem",
        fontWeight: 700,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      {s.icon && <span style={{ fontSize: "0.72rem" }}>{s.icon}</span>}
      {s.label || status}
    </span>
  );
}

/** Tiny check/cross indicator for compliance items in the registrant table */
export function ComplianceCheck({ ok, label, href, onClick }) {
  const icon = ok ? "\u2713" : "\u2715";
  const color = ok ? "#1a6b2c" : "#b91c1c";
  const bg = ok ? "rgba(26,107,44,0.08)" : "rgba(185,28,28,0.06)";
  const common = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: "0.68rem",
    fontWeight: 700,
    color,
    background: bg,
    lineHeight: 1.6,
    textDecoration: "none",
    whiteSpace: "nowrap",
  };
  if (href && ok) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={common}
        onClick={onClick}
      >
        <span>{icon}</span> {label}
      </a>
    );
  }
  return (
    <span style={common}>
      <span>{icon}</span> {label}
    </span>
  );
}

export function InfoCell({ label, value, capitalize }) {
  if (!value) return null;
  return (
    <div
      style={{
        padding: "8px 12px",
        background: "rgba(255,255,255,0.7)",
        borderRadius: 8,
        borderLeft: "3px solid var(--green-light)",
      }}
    >
      <div
        style={{
          fontSize: "0.58rem",
          fontWeight: 800,
          letterSpacing: 2.5,
          textTransform: "uppercase",
          color: "var(--ink-soft)",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "0.84rem",
          fontWeight: 500,
          lineHeight: 1.45,
          textTransform: capitalize ? "capitalize" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** Section label used inside expanded detail panels */
export function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: "0.62rem",
        fontWeight: 800,
        letterSpacing: 2.5,
        textTransform: "uppercase",
        color: "var(--ink-soft)",
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}
