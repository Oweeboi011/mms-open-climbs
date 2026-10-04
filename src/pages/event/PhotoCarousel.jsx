import Icon from "@/components/Icon";

export default function PhotoCarousel({
  carouselIndex,
  climb,
  setCarouselIndex,
  setLightboxIndex,
}) {
  return (
    <>
      {/* Photos */}
      {climb.trailImages?.length > 0 && (
        <div className="section-card">
          <div className="section-header">
            <span className="icon">
              <Icon name="camera" size={17} />
            </span>
            <h3>Photos</h3>
          </div>
          <div className="section-body">
            {(() => {
              const imgs = climb.trailImages;
              const ci = Math.min(carouselIndex, imgs.length - 1);
              return (
                <div style={{ marginBottom: 0 }}>
                  <div
                    style={{
                      position: "relative",
                      borderRadius: 10,
                      overflow: "hidden",
                      background: "#000",
                    }}
                  >
                    <img
                      src={imgs[ci]}
                      alt={`${climb.title} photo ${ci + 1}`}
                      onClick={() => setLightboxIndex(ci)}
                      style={{
                        width: "100%",
                        height: 340,
                        objectFit: "cover",
                        display: "block",
                        cursor: "zoom-in",
                      }}
                    />
                    {ci > 0 && (
                      <button
                        onClick={() => setCarouselIndex(ci - 1)}
                        style={{
                          position: "absolute",
                          left: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "rgba(0,0,0,0.45)",
                          border: "none",
                          color: "#fff",
                          fontSize: "1.6rem",
                          borderRadius: 99,
                          width: 40,
                          height: 40,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        &#8249;
                      </button>
                    )}
                    {ci < imgs.length - 1 && (
                      <button
                        onClick={() => setCarouselIndex(ci + 1)}
                        style={{
                          position: "absolute",
                          right: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "rgba(0,0,0,0.45)",
                          border: "none",
                          color: "#fff",
                          fontSize: "1.6rem",
                          borderRadius: 99,
                          width: 40,
                          height: 40,
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
                        bottom: 10,
                        right: 12,
                        background: "rgba(0,0,0,0.5)",
                        color: "#fff",
                        fontSize: "0.75rem",
                        borderRadius: 99,
                        padding: "2px 10px",
                      }}
                    >
                      {ci + 1} / {imgs.length}
                    </div>
                  </div>
                  {imgs.length > 1 && (
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 8,
                        overflowX: "auto",
                        paddingBottom: 4,
                        scrollbarWidth: "thin",
                      }}
                    >
                      {imgs.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Thumbnail ${i + 1}`}
                          onClick={() => setCarouselIndex(i)}
                          style={{
                            width: 72,
                            height: 52,
                            objectFit: "cover",
                            borderRadius: 6,
                            flexShrink: 0,
                            cursor: "pointer",
                            border:
                              i === ci
                                ? "2px solid var(--accent)"
                                : "2px solid transparent",
                            opacity: i === ci ? 1 : 0.6,
                            transition: "opacity 0.15s, border-color 0.15s",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
