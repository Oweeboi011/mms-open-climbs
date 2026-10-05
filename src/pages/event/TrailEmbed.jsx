

export default function TrailEmbed({ embed, title, height, source }) {
  if (!embed) return null;
  return (
    <div className="trail-embed-block">
      <iframe
        src={embed.embedSrc}
        title={title}
        height={height}
        className="trail-embed"
        loading="lazy"
        allow="fullscreen"
        allowFullScreen
      />
      <p className="trail-embed-credit">
        Trail data &copy;{" "}
        <a href={embed.pageUrl} target="_blank" rel="noopener noreferrer">
          {source}
        </a>
      </p>
    </div>
  );
}
