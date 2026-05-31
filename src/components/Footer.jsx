export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-mountains" aria-hidden="true">
        <svg viewBox="0 0 1200 80" preserveAspectRatio="none">
          <path d="M0,0 L0,80 L1200,80 L1200,0 L1140,18 L1080,8 L1020,22 L960,12 L900,28 L840,15 L780,32 L720,20 L660,38 L600,25 L540,42 L480,28 L420,48 L360,32 L300,52 L240,35 L180,50 L120,38 L60,52 L0,0 Z" fill="var(--green-dark)" />
          <path d="M0,20 L0,80 L1200,80 L1200,20 L1140,35 L1080,25 L1020,40 L960,30 L900,45 L840,32 L780,48 L720,36 L660,50 L600,40 L540,55 L480,42 L420,58 L360,45 L300,60 L240,48 L180,58 L120,50 L60,60 L0,20 Z" fill="rgba(26,77,35,0.4)" />
        </svg>
      </div>
      <div className="footer-content">
        <p><strong>Metropolitan Mountaineering Society</strong> &bull; Open Climbs 2026</p>
        <p>For inquiries, contact your MMS Open Climbs Coordinator.</p>
      </div>
    </footer>
  );
}
