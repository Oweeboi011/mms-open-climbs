export default function GcashQrModal({ climb, qrModalOpen, setQrModalOpen }) {
  return (
    <>
      {/* GCash QR Modal */}
      {qrModalOpen && (
        <div
          onClick={() => setQrModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              maxWidth: 360,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 4 }}>
              GCash QR Code
            </div>
            {climb.gcashName && (
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--ink-soft)",
                  marginBottom: 12,
                }}
              >
                {climb.gcashName}
                {climb.gcashNumber ? ` · ${climb.gcashNumber}` : ""}
              </div>
            )}
            {climb?.gcashQrUrl ? (
              <img
                src={climb.gcashQrUrl}
                alt="GCash QR Code"
                style={{
                  width: "100%",
                  maxWidth: 280,
                  height: "auto",
                  objectFit: "contain",
                  borderRadius: 8,
                  display: "block",
                  margin: "0 auto 16px",
                }}
              />
            ) : (
              <div
                style={{
                  padding: "24px 0 20px",
                  color: "var(--ink-soft)",
                  fontSize: "0.85rem",
                }}
              >
                QR code has not been uploaded yet.
                <br />
                Please contact the climb officers for the GCash number.
              </div>
            )}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setQrModalOpen(false)}
              style={{ width: "100%" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
