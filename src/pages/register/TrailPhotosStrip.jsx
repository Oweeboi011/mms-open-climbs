export default function TrailPhotosStrip({ climb }) {
  return (
    <>
      {/* Trail Photos Strip */}
      {climb.trailImages?.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 10,
            overflowX: "auto",
            padding: "12px 0 4px",
            scrollbarWidth: "thin",
            marginBottom: 8,
          }}
        >
          {climb.trailImages.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`${climb.title} trail photo ${i + 1}`}
              style={{
                height: 160,
                width: "auto",
                minWidth: 220,
                objectFit: "cover",
                borderRadius: 10,
                flexShrink: 0,
                border: "1px solid var(--border)",
                display: "block",
              }}
            />
          ))}
        </div>
      )}

    </>
  );
}
