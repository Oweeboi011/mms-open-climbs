import "./register.css";
export default function TrailPhotosStrip({ climb }) {
  return (
    <>
      {/* Trail Photos Strip */}
      {climb.trailImages?.length > 0 && (
        <div className="trail-strip">
          {climb.trailImages.map((url, i) => (
            <img className="trail-strip-image" key={i} src={url} alt={`${climb.title} trail photo ${i + 1}`} />
          ))}
        </div>
      )}
    </>
  );
}
