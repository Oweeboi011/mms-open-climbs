import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function Signup() {
  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from     = new URLSearchParams(location.search).get('redirect') || '/';

  const [form,    setForm]    = useState({ displayName: '', email: '', password: '', confirm: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8)       { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await signup(form.email, form.password, form.displayName);
      navigate(from, { replace: true });
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate(from, { replace: true });
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
          <p className="auth-panel-org">Metropolitan<br />Mountaineering<br />Society</p>
          <p className="auth-panel-year">Open Climbs 2026</p>
          <div className="auth-panel-mountains">
            <svg viewBox="0 0 400 160" preserveAspectRatio="none">
              <path d="M0,160 L0,130 L40,110 L80,120 L130,85 L180,100 L230,62 L280,78 L330,45 L370,60 L400,40 L400,160 Z" fill="rgba(46,125,50,0.30)" />
              <path d="M0,160 L0,140 L60,125 L120,135 L190,110 L250,120 L320,98 L370,108 L400,95 L400,160 Z" fill="rgba(13,43,18,0.45)" />
              <path d="M0,160 L0,150 L80,142 L160,148 L240,138 L310,145 L400,135 L400,160 Z" fill="rgba(0,0,0,0.20)" />
            </svg>
          </div>
          <p className="auth-panel-quote">"The mountains are calling<br />and I must go."</p>
        </div>

        <div className="auth-card">
          <div className="auth-logo">
            <img src="/MMS.png" alt="MMS Logo" />
          </div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join MMS Open Climbs 2026</p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label required">Full Name</label>
              <input
                type="text" className="form-input" required placeholder="Juan dela Cruz"
                value={form.displayName}
                onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label required">Email</label>
              <input
                type="email" className="form-input" required
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Password</label>
                <input
                  type="password" className="form-input" required minLength={8}
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label required">Confirm Password</label>
                <input
                  type="password" className="form-input" required
                  value={form.confirm}
                  onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                />
              </div>
            </div>
            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
              {loading ? <span className="spinner spinner-sm" /> : 'Create Account'}
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>

          <button className="btn btn-google btn-block" onClick={handleGoogle} disabled={loading}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function friendlyError(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'An account with this email already exists.';
    case 'auth/invalid-email':        return 'Invalid email address.';
    case 'auth/weak-password':        return 'Password is too weak. Use at least 8 characters.';
    default:                          return 'Sign-up failed. Please try again.';
  }
}
