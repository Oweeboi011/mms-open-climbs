export default function LoadingSpinner({ fullPage = false }) {
  const inner = (
    <div className="loader-wrap">
      <svg
        className="loader-mountain"
        viewBox="0 0 80 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Back range */}
        <path d="M0 55 L18 30 L36 55 Z" fill="rgba(46,125,50,0.25)" />
        <path d="M30 55 L52 22 L74 55 Z" fill="rgba(46,125,50,0.20)" />
        {/* Front peak */}
        <path d="M10 55 L40 8 L70 55 Z" fill="var(--green-mid)" />
        {/* Snow cap */}
        <path d="M40 8 L32 22 L40 19 L48 22 Z" fill="var(--gold-light)" />
        {/* Animated dot climbing */}
        <circle
          className="loader-dot"
          cx="70"
          cy="55"
          r="3"
          fill="var(--gold)"
        />
      </svg>
      <p className="loader-text">Loading&hellip;</p>
    </div>
  );

  if (fullPage) {
    return <div className="loader-fullpage">{inner}</div>;
  }
  return inner;
}
