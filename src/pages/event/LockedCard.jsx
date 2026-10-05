import Icon from "@/components/Icon";

export default function LockedCard({ label, onUnlock }) {
  return (
    <button
      onClick={onUnlock}
      style={{
        width: "100%",
        textAlign: "center",
        padding: "28px 16px",
        background: "var(--surface-alt, #f8f5ee)",
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}
      >
        <Icon name="lock" size={30} color="var(--ink-soft)" />
      </div>
      <p
        style={{
          fontWeight: 700,
          fontSize: "0.95rem",
          marginBottom: 6,
          color: "var(--ink)",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: "0.83rem", color: "var(--ink-soft)", margin: 0 }}>
        Tap to sign in or create a free account.
      </p>
    </button>
  );
}
