import "./event.css";

// Full-screen photo viewer: arrows / Escape on the keyboard, click outside
// the photo to close.
export default function PhotoLightbox({ climb, lightboxIndex, setLightboxIndex }) {
  if (lightboxIndex === null) return null;
  const total = climb.trailImages.length;
  const go = (i) => (e) => {
    e.stopPropagation();
    setLightboxIndex(i);
  };
  function onKeyDown(e) {
    if (e.key === "ArrowLeft" && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
    if (e.key === "ArrowRight" && lightboxIndex < total - 1) setLightboxIndex(lightboxIndex + 1);
    if (e.key === "Escape") setLightboxIndex(null);
  }
  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${climb.title} photos`}
      tabIndex={-1}
      ref={(el) => el?.focus()}
      onClick={() => setLightboxIndex(null)}
      onKeyDown={onKeyDown}
    >
      {lightboxIndex > 0 && (
        <button type="button" className="lightbox-nav lightbox-nav--prev" onClick={go(lightboxIndex - 1)} aria-label="Previous photo">
          &#8249;
        </button>
      )}
      <img
        className="lightbox-image"
        src={climb.trailImages[lightboxIndex]}
        alt={`${climb.title} photo ${lightboxIndex + 1}`}
        onClick={(e) => e.stopPropagation()}
      />
      {lightboxIndex < total - 1 && (
        <button type="button" className="lightbox-nav lightbox-nav--next" onClick={go(lightboxIndex + 1)} aria-label="Next photo">
          &#8250;
        </button>
      )}
      <div className="lightbox-bar">
        <span className="lightbox-count">
          {lightboxIndex + 1} / {total}
        </span>
        <button type="button" className="lightbox-close" onClick={() => setLightboxIndex(null)} aria-label="Close photos">
          &#x2715;
        </button>
      </div>
    </div>
  );
}
