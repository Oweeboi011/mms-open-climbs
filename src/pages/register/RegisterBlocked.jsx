import { CLOSED_REASON } from "@/pages/register/registerShared";
import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import "./register.css";

export default function RegisterBlocked({ blockedReason, climb, climbId }) {
  return (
    <>
      <div className="register-page">
        <Header />
        <main className="register-content">
          <div className="register-form-card">
            <div className="form-section-title">
              {blockedReason === "registered" ? "You're Already Registered" : "Registration Is Not Open"}
            </div>
            <p className="register-blocked-text">
              {blockedReason === "registered" ? (
                <>
                  You already have a registration for <strong>{climb.title}</strong>.
                </>
              ) : (
                <>
                  Registration for <strong>{climb.title}</strong> is{" "}
                  {CLOSED_REASON[climb.status] || "not currently open"}.
                </>
              )}
            </p>
            <div className="register-blocked-actions">
              {blockedReason === "registered" ? (
                <Link to="/my-registrations" className="btn btn-primary">
                  View My Climbs
                </Link>
              ) : (
                <Link to={`/event/${climbId}`} className="btn btn-primary">
                  View Climb Details
                </Link>
              )}
              <Link to="/" className="btn btn-outline">
                Browse Other Climbs
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
