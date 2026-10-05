import SectionCard from "@/components/SectionCard";
import "./event.css";

export default function PhotoCarousel({ carouselIndex, climb, setCarouselIndex, setLightboxIndex }) {
  const imgs = climb.trailImages || [];
  if (imgs.length === 0) return null;
  const ci = Math.min(carouselIndex, imgs.length - 1);
  return (
    <SectionCard icon="camera" title="Photos">
      <div className="carousel-stage">
        <button
          type="button"
          className="carousel-image-button"
          onClick={() => setLightboxIndex(ci)}
          aria-label={`Open photo ${ci + 1} full screen`}
        >
          <img className="carousel-image" src={imgs[ci]} alt={`${climb.title} photo ${ci + 1}`} />
        </button>
        {ci > 0 && (
          <button
            type="button"
            className="carousel-nav carousel-nav--prev"
            onClick={() => setCarouselIndex(ci - 1)}
            aria-label="Previous photo"
          >
            &#8249;
          </button>
        )}
        {ci < imgs.length - 1 && (
          <button
            type="button"
            className="carousel-nav carousel-nav--next"
            onClick={() => setCarouselIndex(ci + 1)}
            aria-label="Next photo"
          >
            &#8250;
          </button>
        )}
        <div className="carousel-count" aria-hidden="true">
          {ci + 1} / {imgs.length}
        </div>
      </div>
      {imgs.length > 1 && (
        <div className="carousel-thumbs">
          {imgs.map((url, i) => (
            <button
              key={i}
              type="button"
              className="carousel-thumb"
              aria-current={i === ci}
              aria-label={`Show photo ${i + 1}`}
              onClick={() => setCarouselIndex(i)}
            >
              <img src={url} alt="" />
            </button>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
