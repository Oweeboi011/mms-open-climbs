import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ClimbCard from '@/components/ClimbCard';
import LoadingSpinner from '@/components/LoadingSpinner';

const MONTHS      = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_LABEL = { jul: 'July 2026', aug: 'August 2026', sep: 'September 2026', oct: 'October 2026', nov: 'November 2026', dec: 'December 2026' };
const FILTERS     = [
  { key: 'all',     label: 'All' },
  { key: 'minor',   label: 'Minor' },
  { key: 'major',   label: 'Major' },
  { key: 'special', label: 'Special' },
  { key: 'jul',     label: 'July' },
  { key: 'aug',     label: 'August' },
  { key: 'sep',     label: 'September' },
  { key: 'oct',     label: 'October' },
  { key: 'nov',     label: 'November' },
  { key: 'dec',     label: 'December' },
];

export default function Schedule() {
  const [climbs,       setClimbs]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showTop,      setShowTop]      = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'climbs'),
      where('status', 'in', ['open', 'closed', 'completed']),
      orderBy('startDate', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setClimbs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Filter
  const filtered = climbs.filter(c => {
    if (activeFilter === 'all') return true;
    if (['minor', 'major', 'special'].includes(activeFilter)) return c.type === activeFilter;
    return c.month === activeFilter;
  });

  // Build flat list of section headers + cards for the CSS grid
  const flatItems = [];
  MONTHS.forEach(month => {
    const monthClimbs = filtered.filter(c => c.month === month);
    if (monthClimbs.length > 0) {
      flatItems.push({ type: 'header', id: `hdr-${month}`, month });
      monthClimbs.forEach(c => flatItems.push({ type: 'climb', id: c.id, climb: c }));
    }
  });

  const stats = {
    total:   climbs.length,
    major:   climbs.filter(c => c.type === 'major').length,
    minor:   climbs.filter(c => c.type === 'minor').length,
    special: climbs.filter(c => c.type === 'special').length,
  };

  return (
    <div>
      <Header />

      <section className="hero">
        <div className="hero-stars" aria-hidden="true" />
        <p className="hero-eyebrow">Metropolitan Mountaineering Society &bull; Founded 1994</p>
        <h2 className="hero-title">
          <span className="label-open">Open Climb:</span>
          <span className="label-climb">Schedule</span>
        </h2>
        <div className="hero-divider" />
        <p className="hero-tagline">Welcome Participation from Interested Guests</p>
        <p className="hero-subtitle">
          &#9678; {stats.total} Summits &middot; 6 Months &middot; 1 Community &#9678;
        </p>
        <div className="hero-mountains" aria-hidden="true">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,120 L0,95 L60,80 L120,90 L180,65 L240,75 L300,50 L360,60 L420,35 L480,55 L540,30 L600,20 L660,35 L720,25 L780,40 L840,30 L900,50 L960,38 L1020,55 L1080,45 L1140,60 L1200,50 L1200,120 Z" fill="rgba(26,77,35,0.5)" />
            <path d="M0,120 L0,100 L80,92 L160,85 L240,95 L320,75 L400,82 L480,60 L560,72 L640,50 L720,65 L800,45 L880,58 L960,48 L1040,62 L1120,55 L1200,65 L1200,120 Z" fill="rgba(13,43,18,0.6)" />
            <path d="M0,120 L0,108 L100,102 L200,110 L300,98 L400,105 L500,92 L600,100 L700,88 L800,96 L900,85 L1000,95 L1100,90 L1200,100 L1200,120 Z" fill="var(--surface)" />
          </svg>
        </div>
      </section>

      <div className="stats-bar">
        <div className="stat"><div className="stat-num">{stats.total}</div><div className="stat-label">Total Climbs</div></div>
        <div className="stat"><div className="stat-num">{stats.major}</div><div className="stat-label">Major</div></div>
        <div className="stat"><div className="stat-num">{stats.minor}</div><div className="stat-label">Minor</div></div>
        <div className="stat"><div className="stat-num">{stats.special}</div><div className="stat-label">Special</div></div>
      </div>

      <div className="filters-wrap">
        <div className="filters">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`filter-btn${activeFilter === f.key ? ' active' : ''}`}
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : flatItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-mountain" aria-hidden="true">
            <svg viewBox="0 0 200 130" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 120 L70 40 L120 120 Z" fill="var(--green-pale)" stroke="var(--border)" strokeWidth="1.5" />
              <path d="M70 40 L58 62 L70 58 L82 62 Z" fill="var(--gold-pale)" stroke="var(--gold)" strokeWidth="1" />
              <path d="M90 120 L140 55 L190 120 Z" fill="var(--green-pale)" stroke="var(--border)" strokeWidth="1.5" />
              <path d="M140 55 L128 78 L140 74 L152 78 Z" fill="var(--gold-pale)" stroke="var(--gold)" strokeWidth="1" />
              <line x1="0" y1="120" x2="200" y2="120" stroke="var(--border)" strokeWidth="1.5" />
            </svg>
          </div>
          <h3 className="empty-state-title">No climbs found</h3>
          <p className="empty-state-sub">Try a different filter to see upcoming climbs.</p>
          <button className="btn btn-primary" onClick={() => setActiveFilter('all')}>
            Show all climbs
          </button>
        </div>
      ) : (
        <main className="grid">
          {flatItems.map(item =>
            item.type === 'header'
              ? <div key={item.id} className="section-month">{MONTH_LABEL[item.month]}</div>
              : <ClimbCard key={item.id} climb={item.climb} />
          )}
        </main>
      )}

      <Footer />

      <button
        className={`back-top${showTop ? ' show' : ''}`}
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        &#9650;
      </button>
    </div>
  );
}
