import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  const { currentUser, userProfile, isAdmin, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close drawer on navigation
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    navigate('/');
  }

  const navClass  = ({ isActive }) => `header-nav-link${isActive ? ' active' : ''}`;
  const mnavClass = ({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`;

  return (
    <>
      <header className="header">
        <Link to="/" className="header-brand">
          <img src="/MMS.png" alt="MMS Logo" className="header-logo" />
          <div className="header-text">
            <h1>Metropolitan <em>Mountaineering</em> Society</h1>
            <p>Open Climbs 2026</p>
          </div>
        </Link>

        <nav className="header-nav" aria-label="Main navigation">
          <NavLink to="/" end className={navClass}>Schedule</NavLink>
          {currentUser && (
            <NavLink to="/my-registrations" className={navClass}>My Climbs</NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => `header-nav-link gold${isActive ? ' active' : ''}`}>
              Admin
            </NavLink>
          )}
          {currentUser ? (
            <>
              <span className="header-user-name">{userProfile?.displayName || currentUser.email}</span>
              <button className="header-btn header-btn-outline" onClick={handleLogout}>Sign Out</button>
            </>
          ) : (
            <>
              <Link to="/login"  className="header-btn header-btn-outline">Sign In</Link>
              <Link to="/signup" className="header-btn header-btn-primary">Join</Link>
            </>
          )}
        </nav>

        {/* Hamburger — visible only on mobile via CSS */}
        <button
          className={`ham-btn${menuOpen ? ' open' : ''}`}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen(m => !m)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </header>

      {/* Mobile slide-in drawer */}
      <div id="mobile-nav" className={`mobile-nav${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen}>
        <nav className="mobile-nav-links">
          <NavLink to="/" end className={mnavClass}>
            <span className="mobile-nav-icon" aria-hidden="true">&#9650;</span> Schedule
          </NavLink>
          {currentUser && (
            <NavLink to="/my-registrations" className={mnavClass}>
              <span className="mobile-nav-icon" aria-hidden="true">&#9679;</span> My Climbs
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => `mobile-nav-link gold${isActive ? ' active' : ''}`}>
              <span className="mobile-nav-icon" aria-hidden="true">&#9733;</span> Admin
            </NavLink>
          )}

          <div className="mobile-nav-divider" />

          {currentUser ? (
            <>
              <div className="mobile-nav-user">
                <div className="mobile-nav-avatar">
                  {(userProfile?.displayName || currentUser.email || '?')[0].toUpperCase()}
                </div>
                <span className="mobile-nav-username">
                  {userProfile?.displayName || currentUser.email}
                </span>
              </div>
              <button className="mobile-nav-signout" onClick={handleLogout}>Sign Out</button>
            </>
          ) : (
            <div className="mobile-nav-auth">
              <Link to="/login"  className="btn btn-outline btn-block">Sign In</Link>
              <Link to="/signup" className="btn btn-gold btn-block">Join MMS</Link>
            </div>
          )}
        </nav>
      </div>

      {/* Tap-outside backdrop */}
      <div
        className={`mobile-nav-backdrop${menuOpen ? ' show' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
    </>
  );
}
