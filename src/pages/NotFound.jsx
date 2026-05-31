import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <div className="notfound-page">
      <Header />
      <div className="notfound-body">
        {/* Mountain silhouette */}
        <div className="notfound-mountain" aria-hidden="true">
          <svg
            viewBox="0 0 600 260"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Back peaks */}
            <path
              d="M0 240 L80 160 L160 220 L240 130 L320 200 L400 110 L480 175 L560 140 L600 160 L600 240 Z"
              fill="rgba(46,125,50,0.12)"
            />
            {/* Mid range */}
            <path
              d="M0 240 L100 180 L200 210 L300 140 L400 195 L500 155 L600 180 L600 240 Z"
              fill="rgba(46,125,50,0.22)"
            />
            {/* Front peak — centred */}
            <path
              d="M150 240 L300 60 L450 240 Z"
              fill="var(--green-pale)"
              stroke="var(--border)"
              strokeWidth="1.5"
            />
            {/* Snow cap */}
            <path
              d="M300 60 L272 108 L300 100 L328 108 Z"
              fill="var(--gold-pale)"
              stroke="var(--gold)"
              strokeWidth="1.5"
            />
            {/* Ground line */}
            <line
              x1="0"
              y1="240"
              x2="600"
              y2="240"
              stroke="var(--border)"
              strokeWidth="1.5"
            />
            {/* Stars */}
            <circle
              cx="80"
              cy="40"
              r="2"
              fill="var(--gold-light)"
              opacity="0.5"
            />
            <circle
              cx="160"
              cy="22"
              r="1.5"
              fill="var(--gold-light)"
              opacity="0.4"
            />
            <circle
              cx="420"
              cy="30"
              r="2"
              fill="var(--gold-light)"
              opacity="0.5"
            />
            <circle
              cx="510"
              cy="15"
              r="1.5"
              fill="var(--gold-light)"
              opacity="0.35"
            />
            <circle
              cx="540"
              cy="50"
              r="1"
              fill="var(--gold-light)"
              opacity="0.45"
            />
            <circle
              cx="50"
              cy="65"
              r="1"
              fill="var(--gold-light)"
              opacity="0.3"
            />
          </svg>
        </div>

        <div className="notfound-code">404</div>
        <div className="notfound-title">Trail Not Found</div>
        <p className="notfound-sub">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has been
          moved.
        </p>
        <Link to="/" className="btn btn-primary btn-lg">
          &#8592; Back to Schedule
        </Link>
      </div>
      <Footer />
    </div>
  );
}
