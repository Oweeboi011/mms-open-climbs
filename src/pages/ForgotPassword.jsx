import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AuthLayout from "@/components/AuthLayout";

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
    <AuthLayout quote={<>&ldquo;Not all those who wander<br />are lost.&rdquo;</>}>
        <div className="auth-card">
          <div className="auth-logo">
            <img src="/MMS.png" alt="MMS Logo" />
          </div>
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">MMS Open Climbs</p>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label required" htmlFor="forgot-email">
                Email Address
              </label>
              <input
                id="forgot-email"
                type="email"
                className="form-input"
                autoComplete="email"
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
    </AuthLayout>
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
