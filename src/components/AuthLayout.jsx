import Footer from "@/components/Footer";
import Header from "@/components/Header";

// Shell shared by the sign-in, sign-up and reset pages: the decorative
// mountain panel (hidden on phones) beside the page's own card.
export default function AuthLayout({ quote, children }) {
  return (
    <div className="auth-page">
      <Header />
      <main className="auth-container">
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
          <p className="auth-panel-year">Open Climbs</p>
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
          <p className="auth-panel-quote">{quote}</p>
        </div>
        {children}
      </main>
      <Footer />
    </div>
  );
}
