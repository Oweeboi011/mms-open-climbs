export default function PhotoLightbox({ climb, lightboxIndex, setLightboxIndex }) {
  return (
    <>
      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          onClick={() => setLightboxIndex(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" && lightboxIndex > 0)
              setLightboxIndex(lightboxIndex - 1);
            if (
              e.key === "ArrowRight" &&
              lightboxIndex < climb.trailImages.length - 1
            )
              setLightboxIndex(lightboxIndex + 1);
            if (e.key === "Escape") setLightboxIndex(null);
          }}
          tabIndex={0}
          ref={(el) => el && el.focus()}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.88)",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            outline: "none",
          }}
        >
          {lightboxIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex - 1);
              }}
              style={{
                position: "absolute",
                left: 16,
                background: "rgba(255,255,255,0.15)",
                border: "none",
                color: "#fff",
                fontSize: "1.8rem",
                borderRadius: 99,
                width: 48,
                height: 48,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              &#8249;
            </button>
          )}
          <img
            src={climb.trailImages[lightboxIndex]}
            alt={`${climb.title} photo ${lightboxIndex + 1}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "88dvh",
              objectFit: "contain",
              borderRadius: 10,
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
          />
          {lightboxIndex < climb.trailImages.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex + 1);
              }}
              style={{
                position: "absolute",
                right: 16,
                background: "rgba(255,255,255,0.15)",
                border: "none",
                color: "#fff",
                fontSize: "1.8rem",
                borderRadius: 99,
                width: 48,
                height: 48,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              &#8250;
            </button>
          )}
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <span
              style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem" }}
            >
              {lightboxIndex + 1} / {climb.trailImages.length}
            </span>
            <button
              onClick={() => setLightboxIndex(null)}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "none",
                color: "#fff",
                fontSize: "1.2rem",
                borderRadius: 99,
                width: 36,
                height: 36,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              &#x2715;
            </button>
          </div>
        </div>
      )}
    </>
  );
}
