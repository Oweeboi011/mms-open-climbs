import { useId } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/Icon";
import Modal from "@/components/Modal";
import "./event.css";

// Shown when a signed-out visitor taps a locked card.
export default function SignInModal({ climbId, setShowSignInModal, showSignInModal }) {
  const titleId = useId();
  if (!showSignInModal) return null;
  const close = () => setShowSignInModal(false);
  return (
    <Modal onClose={close} labelledBy={titleId} layer="top" className="signin-dialog">
      <div className="signin-dialog-icon">
        <Icon name="activity" size={36} color="var(--green-dark)" />
      </div>
      <h2 id={titleId} className="signin-dialog-title">
        Members Only
      </h2>
      <p className="signin-dialog-text">
        This section is only visible to registered members. Sign in or create a free account to view full event details
        and register your spot.
      </p>
      <div className="signin-dialog-actions">
        <Link to={`/login?redirect=/event/${climbId}`} className="btn btn-gold" onClick={close}>
          Sign In
        </Link>
        <Link to={`/signup?redirect=/event/${climbId}`} className="btn btn-outline" onClick={close}>
          Create Account
        </Link>
      </div>
    </Modal>
  );
}
