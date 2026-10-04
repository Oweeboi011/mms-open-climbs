import { Link } from "react-router-dom";
import Icon from "@/components/Icon";

// Shown when a signed-out visitor taps a locked card.
export default function SignInModal({ climbId, setShowSignInModal, showSignInModal }) {
  return (
    <>
      {/* Sign-in required modal */}
      {showSignInModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="signin-modal-title"
          onClick={() => setShowSignInModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 1300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "36px 32px 28px",
              maxWidth: 420,
              width: "100%",
              boxShadow: "0 12px 48px rgba(0,0,0,0.22)",
              textAlign: "center",
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowSignInModal(false)}
              aria-label="Close"
              style={{
                position: "absolute",
                top: 14,
                right: 16,
                background: "none",
                border: "none",
                fontSize: "1.3rem",
                cursor: "pointer",
                color: "var(--ink-soft)",
                lineHeight: 1,
              }}
            >
              &#x2715;
            </button>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Icon name="activity" size={36} color="var(--green-dark)" />
            </div>
            <h2
              id="signin-modal-title"
              style={{
                fontFamily: "var(--font-head)",
                fontSize: "1.3rem",
                marginBottom: 8,
                color: "var(--ink)",
              }}
            >
              Members Only
            </h2>
            <p
              style={{
                fontSize: "0.88rem",
                color: "var(--ink-soft)",
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              This section is only visible to registered members. Sign in or
              create a free account to view full event details and register your
              spot.
            </p>
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Link
                to={`/login?redirect=/event/${climbId}`}
                className="btn btn-gold"
                onClick={() => setShowSignInModal(false)}
              >
                Sign In
              </Link>
              <Link
                to={`/signup?redirect=/event/${climbId}`}
                className="btn btn-outline"
                onClick={() => setShowSignInModal(false)}
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
