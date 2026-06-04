import { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ClimbCard from "@/components/ClimbCard";
import LoadingSpinner from "@/components/LoadingSpinner";

const MONTHS = ["jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_LABEL = {
  jul: "July 2026",
  aug: "August 2026",
  sep: "September 2026",
  oct: "October 2026",
  nov: "November 2026",
  dec: "December 2026",
};
const FILTERS = [
  { key: "all", label: "All" },
  { key: "minor", label: "Minor" },
  { key: "major", label: "Major" },
  { key: "special", label: "Special" },
  { key: "jul", label: "July" },
  { key: "aug", label: "August" },
  { key: "sep", label: "September" },
  { key: "oct", label: "October" },
  { key: "nov", label: "November" },
  { key: "dec", label: "December" },
];

export default function Schedule() {
  const [climbs, setClimbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [showTop, setShowTop] = useState(false);
  const gridRef = useRef(null);

  useEffect(() => {
    const q = query(
      collection(db, "climbs"),
      where("status", "in", ["open", "closed", "completed"]),
      orderBy("startDate", "asc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setClimbs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!gridRef.current) return;
    const targets = gridRef.current.querySelectorAll(
      ".card-link, .section-month",
    );
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06 },
    );
    targets.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i * 40, 300)}ms`;
      observer.observe(el);
    });
    return () => observer.disconnect();
  });

  // Filter
  const filtered = climbs.filter((c) => {
    if (activeFilter === "all") return true;
    if (["minor", "major", "special"].includes(activeFilter))
      return c.type === activeFilter;
    return c.month === activeFilter;
  });

  // Build flat list of section headers + cards for the CSS grid
  const flatItems = [];
  MONTHS.forEach((month) => {
    const monthClimbs = filtered
      .filter((c) => c.month === month)
      .sort((a, b) => {
        const da = a.startDate?.toDate?.() ?? new Date(a.startDate ?? 0);
        const db_ = b.startDate?.toDate?.() ?? new Date(b.startDate ?? 0);
        return da - db_;
      });
    if (monthClimbs.length > 0) {
      flatItems.push({ type: "header", id: `hdr-${month}`, month });
      monthClimbs.forEach((c) =>
        flatItems.push({ type: "climb", id: c.id, climb: c }),
      );
    }
  });

  const stats = {
    total: climbs.length,
    major: climbs.filter((c) => c.type === "major").length,
    minor: climbs.filter((c) => c.type === "minor").length,
    special: climbs.filter((c) => c.type === "special").length,
  };

  return (
    <div>
      <Header />

      <section className="hero">
        <div className="hero-stars" aria-hidden="true" />
        <p className="hero-eyebrow">
          Metropolitan Mountaineering Society &bull; Founded 1994
        </p>
        <h2 className="hero-title">
          <span className="label-open">Open Climb:</span>
          <span className="label-climb">Schedule</span>
        </h2>
        <div className="hero-divider" />
        <p className="hero-tagline">
          Welcome Participation from Interested Guests
        </p>
        <p className="hero-subtitle">
          &#9678; {stats.total} Summits &middot; 6 Months &middot; 1 Community
          &#9678;
        </p>
        <div className="hero-mountains" aria-hidden="true">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path
              d="M0,120 L0,95 L60,80 L120,90 L180,65 L240,75 L300,50 L360,60 L420,35 L480,55 L540,30 L600,20 L660,35 L720,25 L780,40 L840,30 L900,50 L960,38 L1020,55 L1080,45 L1140,60 L1200,50 L1200,120 Z"
              fill="rgba(26,77,35,0.5)"
            />
            <path
              d="M0,120 L0,100 L80,92 L160,85 L240,95 L320,75 L400,82 L480,60 L560,72 L640,50 L720,65 L800,45 L880,58 L960,48 L1040,62 L1120,55 L1200,65 L1200,120 Z"
              fill="rgba(13,43,18,0.6)"
            />
            <path
              d="M0,120 L0,108 L100,102 L200,110 L300,98 L400,105 L500,92 L600,100 L700,88 L800,96 L900,85 L1000,95 L1100,90 L1200,100 L1200,120 Z"
              fill="var(--surface)"
            />
          </svg>
          {/* Animated hikers walking along the ridge */}
          <div className="hero-hikers">
            {/* Hiker 1 — leading, gold pack */}
            <svg
              className="hiker hiker-1"
              viewBox="0 0 20 34"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="9" cy="3.5" r="2.8" fill="rgba(255,255,255,0.88)" />
              <path
                d="M6.2,6.2 L6.8,16.5 L11.2,16.5 L11.8,6.2 Q9,5 6.2,6.2Z"
                fill="rgba(255,255,255,0.88)"
              />
              <rect
                x="11.2"
                y="7.5"
                width="4"
                height="5.5"
                rx="1"
                fill="rgba(200,160,0,0.85)"
              />
              <path
                d="M7.5,16.5 L4.2,28.5 L6.5,29 L9,17.5Z"
                fill="rgba(255,255,255,0.88)"
              />
              <path
                d="M10.5,16.5 L12.5,28.5 L14.8,28 L12.5,17.5Z"
                fill="rgba(255,255,255,0.88)"
              />
              <path
                d="M14,9 L17.5,29"
                stroke="rgba(255,255,255,0.55)"
                strokeWidth="1.4"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            {/* Hiker 2 — mid-size, green pack */}
            <svg
              className="hiker hiker-2"
              viewBox="0 0 20 34"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="9" cy="3.5" r="2.4" fill="rgba(255,255,255,0.72)" />
              <path
                d="M6.5,5.8 L7,16 L11,16 L11.5,5.8 Q9,4.8 6.5,5.8Z"
                fill="rgba(255,255,255,0.72)"
              />
              <rect
                x="10.8"
                y="7"
                width="3.5"
                height="5"
                rx="1"
                fill="rgba(46,125,50,0.85)"
              />
              <path
                d="M8,16 L5,27 L7.2,27.5 L9.5,17Z"
                fill="rgba(255,255,255,0.72)"
              />
              <path
                d="M10,16 L11.8,27 L14,26.5 L11.8,17Z"
                fill="rgba(255,255,255,0.72)"
              />
              <path
                d="M13.5,8.5 L16.5,27"
                stroke="rgba(255,255,255,0.42)"
                strokeWidth="1.2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            {/* Hiker 3 — smallest, trailing */}
            <svg
              className="hiker hiker-3"
              viewBox="0 0 20 34"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="9" cy="3.5" r="2" fill="rgba(255,255,255,0.58)" />
              <path
                d="M7,5.5 L7.5,14.5 L10.5,14.5 L11,5.5 Q9,4.6 7,5.5Z"
                fill="rgba(255,255,255,0.58)"
              />
              <rect
                x="10.2"
                y="6.5"
                width="3"
                height="4.5"
                rx="1"
                fill="rgba(200,160,0,0.62)"
              />
              <path
                d="M8,14.5 L5.5,25 L7.5,25.5 L9.5,15.5Z"
                fill="rgba(255,255,255,0.58)"
              />
              <path
                d="M9.5,14.5 L11,25 L13,24.5 L11.2,15.5Z"
                fill="rgba(255,255,255,0.58)"
              />
              <path
                d="M12.5,7.5 L15.5,25"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="1.1"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>
      </section>

      <div className="stats-bar">
        <div className="stat">
          <div className="stat-num">{stats.total}</div>
          <div className="stat-label">Total Climbs</div>
        </div>
        <div className="stat">
          <div className="stat-num">{stats.major}</div>
          <div className="stat-label">Major</div>
        </div>
        <div className="stat">
          <div className="stat-num">{stats.minor}</div>
          <div className="stat-label">Minor</div>
        </div>
        <div className="stat">
          <div className="stat-num">{stats.special}</div>
          <div className="stat-label">Special</div>
        </div>
      </div>

      <div className="filters-wrap">
        <div className="filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`filter-btn${activeFilter === f.key ? " active" : ""}`}
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
            <svg
              viewBox="0 0 200 130"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20 120 L70 40 L120 120 Z"
                fill="var(--green-pale)"
                stroke="var(--border)"
                strokeWidth="1.5"
              />
              <path
                d="M70 40 L58 62 L70 58 L82 62 Z"
                fill="var(--gold-pale)"
                stroke="var(--gold)"
                strokeWidth="1"
              />
              <path
                d="M90 120 L140 55 L190 120 Z"
                fill="var(--green-pale)"
                stroke="var(--border)"
                strokeWidth="1.5"
              />
              <path
                d="M140 55 L128 78 L140 74 L152 78 Z"
                fill="var(--gold-pale)"
                stroke="var(--gold)"
                strokeWidth="1"
              />
              <line
                x1="0"
                y1="120"
                x2="200"
                y2="120"
                stroke="var(--border)"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <h3 className="empty-state-title">No climbs found</h3>
          <p className="empty-state-sub">
            Try a different filter to see upcoming climbs.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setActiveFilter("all")}
          >
            Show all climbs
          </button>
        </div>
      ) : (
        <main className="grid" ref={gridRef}>
          {flatItems.map((item) =>
            item.type === "header" ? (
              <div key={item.id} className="section-month">
                {MONTH_LABEL[item.month]}
              </div>
            ) : (
              <ClimbCard key={item.id} climb={item.climb} />
            ),
          )}
        </main>
      )}

      <Footer />

      <button
        className={`back-top${showTop ? " show" : ""}`}
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        &#9650;
      </button>
    </div>
  );
}
