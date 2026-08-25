import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ClimbCard from "@/components/ClimbCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import MountaineeringGuideModal from "@/components/MountaineeringGuideModal";

const MONTHS = ["jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_LABEL = {
  jul: "July 2026",
  aug: "August 2026",
  sep: "September 2026",
  oct: "October 2026",
  nov: "November 2026",
  dec: "December 2026",
};
// The stats bar doubles as a filter: each tile selects the same key as
// its counterpart in FILTERS below, so the two controls stay in step.
const STAT_FILTERS = [
  { key: "all", stat: "total", label: "Total Climbs" },
  { key: "major", stat: "major", label: "Major" },
  { key: "minor", stat: "minor", label: "Minor" },
  { key: "special", stat: "special", label: "Special" },
];

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
  const { currentUser } = useAuth();
  const [climbs, setClimbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const filtersRef = useRef(null);
  const filtersWrapRef = useRef(null);
  const [showTop, setShowTop] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(
    () => sessionStorage.getItem("oc_visitor_banner") === "1",
  );
  const [guideOpen, setGuideOpen] = useState(false);
  const gridRef = useRef(null);

  function dismissBanner() {
    sessionStorage.setItem("oc_visitor_banner", "1");
    setBannerDismissed(true);
  }

  useEffect(() => {
    const q = query(
      collection(db, "climbs"),
      where("status", "in", ["open", "closed", "completed", "cancelled"]),
      orderBy("startDate", "asc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setClimbs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  // The month buttons scroll off the right on mobile. Keep the fade
  // affordance in sync with the scroll position so it disappears once
  // there is genuinely nothing more to reveal.
  useEffect(() => {
    const strip = filtersRef.current;
    const wrap = filtersWrapRef.current;
    if (!strip || !wrap) return;
    const sync = () => {
      const atEnd =
        strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
      wrap.classList.toggle("scrolled-end", atEnd);
    };
    sync();
    strip.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      strip.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToGrid() {
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
        <div className="hero-cta">
          {!currentUser && (
            <Link to="/signup?redirect=/" className="btn btn-gold btn-lg">
              Create Free Account
            </Link>
          )}
          <button
            className="btn btn-outline-white btn-lg"
            onClick={scrollToGrid}
          >
            Browse Climbs
          </button>
          <button
            className="btn btn-outline-white btn-lg"
            onClick={() => setGuideOpen(true)}
          >
            New to Mountaineering?
          </button>
        </div>

        {guideOpen && (
          <MountaineeringGuideModal onClose={() => setGuideOpen(false)} />
        )}
        <div className="hero-mountains" aria-hidden="true">
          {/* Layered ridgelines: a light back range, the main peaks, a
              dark jagged foreground and a conifer treeline standing on
              the ground line where the page surface begins. */}
          <svg viewBox="0 0 1200 160" preserveAspectRatio="none">
            {/* Back range — palest, sits furthest away */}
            <path
              d="M0,140 L0,104 L120,78 L230,96 L350,62 L470,90 L600,44 L730,86 L850,60 L970,88 L1090,74 L1200,92 L1200,140 Z"
              fill="rgba(150,190,120,0.32)"
            />
            {/* Main range — the dominant central peak */}
            <path
              d="M0,140 L0,120 L110,104 L210,116 L300,84 L360,68 L430,96 L520,72 L600,26 L680,74 L760,100 L830,66 L900,52 L980,88 L1080,102 L1160,92 L1200,104 L1200,140 Z"
              fill="rgba(74,124,58,0.72)"
            />
            {/* Foreground range — darkest, closest */}
            <path
              d="M0,140 L0,128 L90,118 L180,126 L280,110 L380,124 L470,108 L560,120 L650,104 L740,118 L830,106 L920,120 L1010,110 L1100,122 L1200,114 L1200,140 Z"
              fill="#13331a"
            />
            {/* Conifer treeline */}
            <path d="M21.0,140.0 L24.0,132.0 L22.0,132.0 L25.0,124.0 L23.0,124.0 L28.0,112.0 L33.0,124.0 L31.0,124.0 L34.0,132.0 L32.0,132.0 L35.0,140.0 Z M52.4,140.0 L54.8,133.6 L53.2,133.6 L55.6,127.2 L54.0,127.2 L58.0,117.6 L62.0,127.2 L60.4,127.2 L62.8,133.6 L61.2,133.6 L63.6,140.0 Z M78.0,140.0 L81.4,130.8 L79.1,130.8 L82.5,121.6 L80.2,121.6 L86.0,107.8 L91.8,121.6 L89.5,121.6 L92.9,130.8 L90.6,130.8 L94.0,140.0 Z M109.8,140.0 L112.0,134.0 L110.5,134.0 L112.8,128.0 L111.2,128.0 L115.0,119.0 L118.8,128.0 L117.2,128.0 L119.5,134.0 L118.0,134.0 L120.2,140.0 Z M1079.4,140.0 L1081.8,133.6 L1080.2,133.6 L1082.6,127.2 L1081.0,127.2 L1085.0,117.6 L1089.0,127.2 L1087.4,127.2 L1089.8,133.6 L1088.2,133.6 L1090.6,140.0 Z M1104.3,140.0 L1107.6,131.2 L1105.4,131.2 L1108.7,122.4 L1106.5,122.4 L1112.0,109.2 L1117.5,122.4 L1115.3,122.4 L1118.6,131.2 L1116.4,131.2 L1119.7,140.0 Z M1136.8,140.0 L1139.0,134.0 L1137.5,134.0 L1139.8,128.0 L1138.2,128.0 L1142.0,119.0 L1145.8,128.0 L1144.2,128.0 L1146.5,134.0 L1145.0,134.0 L1147.2,140.0 Z M1163.0,140.0 L1166.0,132.0 L1164.0,132.0 L1167.0,124.0 L1165.0,124.0 L1170.0,112.0 L1175.0,124.0 L1173.0,124.0 L1176.0,132.0 L1174.0,132.0 L1177.0,140.0 Z M425.1,140.0 L427.2,134.4 L425.8,134.4 L427.9,128.8 L426.5,128.8 L430.0,120.4 L433.5,128.8 L432.1,128.8 L434.2,134.4 L432.8,134.4 L434.9,140.0 Z M448.7,140.0 L451.4,132.8 L449.6,132.8 L452.3,125.6 L450.5,125.6 L455.0,114.8 L459.5,125.6 L457.7,125.6 L460.4,132.8 L458.6,132.8 L461.3,140.0 Z M739.0,140.0 L741.6,133.2 L739.9,133.2 L742.5,126.4 L740.8,126.4 L745.0,116.2 L749.2,126.4 L747.5,126.4 L750.1,133.2 L748.4,133.2 L751.0,140.0 Z M767.1,140.0 L769.2,134.4 L767.8,134.4 L769.9,128.8 L768.5,128.8 L772.0,120.4 L775.5,128.8 L774.1,128.8 L776.2,134.4 L774.8,134.4 L776.9,140.0 Z" fill="#13331a" />
            {/* Ground — the page surface the hero hands off to */}
            <rect x="0" y="139" width="1200" height="21" fill="var(--surface)" />
          </svg>
        </div>
      </section>

      {!currentUser && !bannerDismissed && (
        <div className="visitor-banner">
          <div className="visitor-banner-inner">
            <div className="visitor-banner-text">
              <strong>Want to join a climb?</strong> Create a free account to
              register for events, upload payment proof, and track your
              registrations.
            </div>
            <div className="visitor-banner-actions">
              <Link to="/signup?redirect=/" className="btn btn-gold">
                Create Account
              </Link>
              <Link to="/login?redirect=/" className="btn btn-outline-white">
                Sign In
              </Link>
            </div>
            <button
              className="visitor-banner-close"
              onClick={dismissBanner}
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      <div className="stats-bar">
        {STAT_FILTERS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`stat${activeFilter === s.key ? " active" : ""}`}
            aria-pressed={activeFilter === s.key}
            onClick={() => setActiveFilter(s.key)}
          >
            <div className="stat-num">{stats[s.stat]}</div>
            <div className="stat-label">{s.label}</div>
          </button>
        ))}
      </div>

      <div className="filters-wrap" ref={filtersWrapRef}>
        <div className="filters" ref={filtersRef}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`filter-btn${activeFilter === f.key ? " active" : ""}`}
              onClick={(e) => {
                setActiveFilter(f.key);
                // inline/nearest so tapping a month never yanks the
                // page up or down, only the strip sideways.
                e.currentTarget.scrollIntoView?.({
                  behavior: "smooth",
                  block: "nearest",
                  inline: "center",
                });
              }}
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
