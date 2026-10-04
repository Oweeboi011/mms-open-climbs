import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

export default function RegisterSuccess({
  climb,
  currentUser,
  successMissingDocs,
  successRegId,
  successUnpaid,
}) {
  return (
    <>
      <div
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        <Header />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>&#10003;</div>
          <h2
            style={{
              fontFamily: "var(--font-head)",
              fontSize: "1.8rem",
              fontWeight: 900,
              textTransform: "uppercase",
              color: "var(--green-dark)",
              marginBottom: 8,
            }}
          >
            Registration Submitted!
          </h2>
          <p style={{ color: "var(--ink-soft)", marginBottom: 8 }}>
            Your registration for <strong>{climb.title}</strong> is{" "}
            <strong>pending confirmation</strong>.
          </p>
          <p
            style={{
              color: "var(--ink-soft)",
              marginBottom: 28,
              fontSize: "0.88rem",
            }}
          >
            A confirmation email has been sent to{" "}
            <strong>{currentUser.email}</strong>. A climb officer will confirm
            your spot soon.
          </p>
          {successUnpaid && (
            <p
              style={{
                color: "#92400e",
                background: "#fef9e7",
                border: "1px solid #fcd34d",
                borderRadius: 8,
                padding: "10px 16px",
                marginBottom: 28,
                fontSize: "0.85rem",
                maxWidth: 460,
              }}
            >
              Your registration is marked <strong>unpaid</strong>. You can
              submit your GCash payment proof anytime from{" "}
              <strong>My Climbs</strong> — we'll remind you via the
              notification bell until it's settled.
            </p>
          )}
          {successMissingDocs.length > 0 && (
            <p
              style={{
                color: "#92400e",
                background: "#fef9e7",
                border: "1px solid #fcd34d",
                borderRadius: 8,
                padding: "10px 16px",
                marginBottom: 28,
                fontSize: "0.85rem",
                maxWidth: 460,
              }}
            >
              We still need your{" "}
              <strong>{successMissingDocs.join(", ")}</strong>. Upload anytime
              from <strong>My Climbs</strong> — we'll remind you via the
              notification bell until it's in.
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <Link to={`/waiver/${successRegId}`} className="btn btn-primary">
              Print Waiver
            </Link>
            <Link to="/my-registrations" className="btn btn-outline">
              View My Climbs
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
