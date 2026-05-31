import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await resetPassword(email);
      setMessage("Check your email for a password reset link.");
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <Header />
      <div className="auth-container">
        <div className="auth-panel" aria-hidden="true">
          <div className="auth-panel-logo">
            <img src="/MMS.png" alt="" />
          </div>
          <p className="auth-panel-org">
            Metropolitan
            <br />
            Mountaineering
            <br />
            Society
          </p>
          <p className="auth-panel-year">Open Climbs 2026</p>
          <div className="auth-panel-mountains">
            <svg viewBox="0 0 400 160" preserveAspectRatio="none">
              <path
                d="M0,160 L0,130 L40,110 L80,120 L130,85 L180,100 L230,62 L280,78 L330,45 L370,60 L400,40 L400,160 Z"
                fill="rgba(46,125,50,0.30)"
              />
              <path
                d="M0,160 L0,140 L60,125 L120,135 L190,110 L250,120 L320,98 L370,108 L400,95 L400,160 Z"
                fill="rgba(13,43,18,0.45)"
              />
              <path
                d="M0,160 L0,150 L80,142 L160,148 L240,138 L310,145 L400,135 L400,160 Z"
                fill="rgba(0,0,0,0.20)"
              />
            </svg>
          </div>
          <p className="auth-panel-quote">
            "Not all those who wander
            <br />
            are lost."
          </p>
        </div>

        <div className="auth-card">
          <div className="auth-logo">
            <img src="/MMS.png" alt="MMS Logo" />
          </div>
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">MMS Open Climbs 2026</p>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label required">Email Address</label>
              <input
                type="email"
                className="form-input"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <button
              className="btn btn-primary btn-block btn-lg"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="spinner spinner-sm" />
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>

          <div className="auth-footer">
            Remembered it? <Link to="/login">Sign In</Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function friendlyError(code) {
  switch (code) {
    case "auth/user-not-found":
      return "No account found with that email.";
    case "auth/invalid-email":
      return "Invalid email address.";
    default:
      return "Could not send reset email. Please try again.";
  }
}
