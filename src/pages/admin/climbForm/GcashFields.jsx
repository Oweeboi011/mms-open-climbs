export default function GcashFields({ form, gcashUploading, handleGcashQrUpload, set }) {
  return (
    <>
      {/* ── GCash Payment ── */}
      <div className="admin-card">
        <div className="admin-card-title">GCash Payment Details</div>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          These details are shown to registrants on the registration form so
          they know where to send payment.
        </p>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">GCash Account Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Juan Dela Cruz"
              value={form.gcashName}
              onChange={(e) => set("gcashName", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">GCash Number</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 09XX XXX XXXX"
              value={form.gcashNumber}
              onChange={(e) => set("gcashNumber", e.target.value)}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">GCash QR Code Image</label>
          {form.gcashQrUrl && (
            <div style={{ marginBottom: 8 }}>
              <img
                src={form.gcashQrUrl}
                alt="GCash QR"
                style={{
                  width: 160,
                  height: 160,
                  objectFit: "contain",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  background: "#fff",
                }}
              />
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="form-input"
            onChange={handleGcashQrUpload}
            disabled={gcashUploading}
          />
          {gcashUploading && (
            <div className="form-hint">Uploading QR code…</div>
          )}
          {form.gcashQrUrl && !gcashUploading && (
            <div
              className="form-hint"
              style={{ color: "var(--green-dark)" }}
            >
              QR code uploaded.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
