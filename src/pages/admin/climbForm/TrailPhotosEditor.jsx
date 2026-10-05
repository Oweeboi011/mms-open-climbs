export default function TrailPhotosEditor({
  form,
  handleTrailImageUpload,
  set,
  setTrailUrlInput,
  trailImgUploading,
  trailUrlInput,
}) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">Trail Photos</label>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 8,
          }}
        >
          {(form.trailImages || []).map((url, i) => (
            <div
              key={i}
              style={{ position: "relative", display: "inline-block" }}
            >
              <img
                src={url}
                alt={`Trail ${i + 1}`}
                style={{
                  width: 100,
                  height: 80,
                  objectFit: "cover",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  display: "block",
                }}
              />
              <button
                type="button"
                onClick={() =>
                  set(
                    "trailImages",
                    form.trailImages.filter((_, idx) => idx !== i),
                  )
                }
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  background: "rgba(0,0,0,0.6)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 99,
                  width: 20,
                  height: 20,
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Remove"
              >
                &#x2715;
              </button>
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <label
            className="btn btn-outline btn-sm"
            style={{
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {trailImgUploading ? "Uploading…" : "↑ Upload Photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={handleTrailImageUpload}
              disabled={trailImgUploading}
            />
          </label>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 10,
            alignItems: "center",
          }}
        >
          <input
            type="url"
            className="form-input"
            placeholder="https://example.com/photo.jpg"
            value={trailUrlInput}
            onChange={(e) => setTrailUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const v = trailUrlInput.trim();
                if (v) {
                  set("trailImages", [...(form.trailImages || []), v]);
                  setTrailUrlInput("");
                }
              }
            }}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              const v = trailUrlInput.trim();
              if (v) {
                set("trailImages", [...(form.trailImages || []), v]);
                setTrailUrlInput("");
              }
            }}
          >
            + Add URL
          </button>
        </div>
        <div className="form-hint" style={{ marginTop: 6 }}>
          Upload photos from your device or paste a direct image URL
          (press Enter or click + Add URL).
        </div>
      </div>
    </>
  );
}
