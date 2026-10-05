import "./StatusPill.css";

// A small rounded status label. `tone` picks the colours from the status
// tokens in globals.css; the label is whatever the caller passes.
export default function StatusPill({ tone = "muted", icon, children, className = "" }) {
  return (
    <span className={`status-pill status-pill--${tone} ${className}`.trim()}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}
