import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";

const STATUS_LABEL = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  waitlisted: "Waitlisted",
};

export default function MyRegistrations() {
  const { currentUser } = useAuth();
  const [regs, setRegs] = useState([]);
  const [officerClimbs, setOfficerClimbs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "registrations"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setRegs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [currentUser.uid]);

  useEffect(() => {
    getDocs(
      query(
        collection(db, "climbs"),
        where("officerIds", "array-contains", currentUser.uid),
        orderBy("startDate"),
      ),
    )
      .then((snap) => {
        setOfficerClimbs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
      .catch(() => {});
  }, [currentUser.uid]);

  return (
    <div className="myreg-page">
      <Header />
      <main className="myreg-main">
        <div className="myreg-heading">
          <h1 className="myreg-title">My Climbs</h1>
          <p className="myreg-email">{currentUser.email}</p>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {officerClimbs.length > 0 && (
              <div style={{ marginBottom: 36 }}>
                <h2 className="myreg-section-title">Assigned as Officer</h2>
                {officerClimbs.map((climb) => {
                  const myEntry = (climb.officers || []).find(
                    (o) => o.userId === currentUser.uid,
                  );
                  return (
                    <div className="reg-card" key={climb.id}>
                      <div className="reg-card-header">
                        <div>
                          <div className="reg-card-title">{climb.title}</div>
                          <div className="reg-card-date">
                            &#128197; {climb.dateLabel} &nbsp;|&nbsp; &#128205;{" "}
                            {climb.location}
                          </div>
                        </div>
                        <span
                          className="status-badge"
                          style={{
                            background: "var(--green-dark)",
                            color: "#fff",
                            textTransform: "uppercase",
                            letterSpacing: 1,
                          }}
                        >
                          {myEntry?.role || "Officer"}
                        </span>
                      </div>
                      <div className="reg-card-actions">
                        <Link
                          to={`/event/${climb.id}`}
                          className="btn btn-outline btn-sm"
                        >
                          View Climb
                        </Link>
                        <Link
                          to={`/admin/climbs/${climb.id}`}
                          className="btn btn-primary btn-sm"
                        >
                          Registrants
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <h2 className="myreg-section-title">My Registrations</h2>
            {regs.length === 0 ? (
              <div
                className="alert alert-info"
                style={{
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <strong>No registrations yet.</strong>
                <Link to="/" className="btn btn-accent btn-sm">
                  Browse Climbs
                </Link>
              </div>
            ) : (
              regs.map((reg) => (
                <div className="reg-card" key={reg.id} data-status={reg.status}>
                  <div className="reg-card-header">
                    <div>
                      <div className="reg-card-title">{reg.climbTitle}</div>
                      <div className="reg-card-date">
                        &#128197; {reg.climbDate} &nbsp;|&nbsp; &#128205;{" "}
                        {reg.climbLocation}
                      </div>
                    </div>
                    <span className={`status-badge status-${reg.status}`}>
                      {STATUS_LABEL[reg.status] || reg.status}
                    </span>
                  </div>

                  <div className="reg-card-body">
                    <div className="reg-detail-grid">
                      <div className="reg-detail-item">
                        <span className="reg-detail-label">Name</span>
                        <strong>{reg.name}</strong>
                      </div>
                      <div className="reg-detail-item">
                        <span className="reg-detail-label">Mobile</span>
                        <strong>{reg.mobile}</strong>
                      </div>
                      <div className="reg-detail-item">
                        <span className="reg-detail-label">
                          Emergency Contact
                        </span>
                        <strong>{reg.emergencyContact?.name}</strong> (
                        {reg.emergencyContact?.relationship})
                      </div>
                      <div className="reg-detail-item">
                        <span className="reg-detail-label">Registered</span>
                        <strong>
                          {reg.createdAt
                            ?.toDate?.()
                            .toLocaleDateString("en-PH") || "—"}
                        </strong>
                      </div>
                    </div>
                    {reg.waiverSigned && (
                      <div className="reg-waiver-signed">
                        &#10003; Waiver signed as{" "}
                        <em>&ldquo;{reg.waiverSignedName}&rdquo;</em>
                      </div>
                    )}
                  </div>

                  <div className="reg-card-actions">
                    <Link
                      to={`/event/${reg.climbId}`}
                      className="btn btn-outline btn-sm"
                    >
                      View Climb
                    </Link>
                    {reg.waiverSigned && (
                      <Link
                        to={`/waiver/${reg.id}`}
                        className="btn btn-primary btn-sm"
                      >
                        Print Waiver
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
