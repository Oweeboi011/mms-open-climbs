import Icon from "@/components/Icon";
import "./event.css";

export default function LockedCard({ label, onUnlock }) {
  return (
    <button type="button" className="locked-card" onClick={onUnlock}>
      <div className="locked-card-icon">
        <Icon name="lock" size={30} color="var(--ink-soft)" />
      </div>
      <p className="locked-card-title">{label}</p>
      <p className="locked-card-hint">Tap to sign in or create a free account.</p>
    </button>
  );
}
