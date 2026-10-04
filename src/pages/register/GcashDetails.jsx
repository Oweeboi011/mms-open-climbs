// Where to send the payment: QR, number and account name.
export default function GcashDetails({ climb, setQrModalOpen }) {
  return (
    <>
      {climb.gcashQrUrl || climb.gcashNumber || climb.gcashName ? (
        <div
          style={{
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 20,
            alignItems: "flex-start",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <img
              src={climb.gcashQrUrl || "/gcash-qr-placeholder.svg"}
              alt="GCash QR Code"
              style={{
                width: 160,
                height: 160,
                objectFit: "contain",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "#fff",
                display: "block",
                cursor: "zoom-in",
              }}
              onClick={() => setQrModalOpen(true)}
            />
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--ink-soft)",
                marginTop: 4,
              }}
            >
              {climb.gcashQrUrl
                ? "Tap to enlarge & scan"
                : "QR code coming soon"}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            {climb.gcashName && (
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                    marginBottom: 2,
                  }}
                >
                  Account Name
                </div>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                  {climb.gcashName}
                </div>
              </div>
            )}
            {climb.gcashNumber && (
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                    marginBottom: 2,
                  }}
                >
                  GCash Number
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    letterSpacing: 1,
                  }}
                >
                  {climb.gcashNumber}
                </div>
              </div>
            )}
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--ink-soft)",
                marginTop: 4,
              }}
            >
              Please use your full name as the payment reference/note.
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 20,
            alignItems: "flex-start",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <img
              src="/gcash-qr-placeholder.svg"
              alt="GCash QR Code Placeholder"
              style={{
                width: 160,
                height: 160,
                objectFit: "contain",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "#fff",
                display: "block",
                opacity: 0.75,
                cursor: "zoom-in",
              }}
              onClick={() => setQrModalOpen(true)}
            />
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--ink-soft)",
                marginTop: 4,
              }}
            >
              QR code coming soon
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--ink-soft)",
                background: "var(--surface-alt)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              GCash payment details are being set up by the organizer.
              Please contact the climb officers for the GCash number. You
              may still complete and submit this registration form —
              attach your proof of payment once available.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
