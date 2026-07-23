import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logFailedRequest } from "@/utils/logFailedRequest";

const STATUS_LABEL = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  waitlisted: "Waitlisted",
};

const PAYMENT_LABEL = {
  unpaid: "Unpaid",
  submitted: "Payment Submitted",
  verified: "Payment Verified",
  rejected: "Payment Rejected",
};

function PayPrompt({ reg, onClose, onSaved }) {
  const [files, setFiles] = useState([]);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (files.length === 0) {
      setError("Please select a screenshot or photo of your GCash receipt.");
      return;
    }
    const parsedAmount = parseFloat(String(amount).replace(/[^0-9.]/g, ""));
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter the exact amount you paid via GCash.");
      return;
    }
    setSaving(true);
    try {
      const timestamp = Date.now();
      const paymentProofs = await Promise.all(
        files.map(async (file) => {
          const fileRef = storageRef(
            storage,
            `payment-proofs/${reg.climbId}/${reg.userId}/${timestamp}_${file.name}`,
          );
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          return { url, fileName: file.name };
        }),
      );
      await updateDoc(doc(db, "registrations", reg.id), {
        paymentProofs,
        paymentStatus: "submitted",
        amountPaid: parsedAmount,
      });
      onSaved();
    } catch (err) {
      setError("Failed to submit payment proof. Please try again.");
      logFailedRequest({
        type: "upload",
        source: "MyRegistrations.jsx:PayPrompt",
        message: err?.message,
        path: window.location.pathname,
        userId: reg.userId,
        climbId: reg.climbId,
        registrationId: reg.id,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: 12,
          padding: 24,
          maxWidth: 420,
          width: "100%",
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>
          Submit Payment
        </h3>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          For <strong>{reg.climbTitle}</strong>
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label required">Amount Paid via GCash</label>
            <input
              type="number"
              min="1"
              step="any"
              className="form-input"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label required">Proof of Payment</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="form-input"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files))}
            />
            {files.length > 0 && (
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--green-dark)",
                  marginTop: 6,
                }}
              >
                &#10003; {files.length} file{files.length > 1 ? "s" : ""} selected
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onClose}
              disabled={saving}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving}
              style={{ flex: 1 }}
            >
              {saving ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MyRegistrations() {
  const { currentUser } = useAuth();
  const [regs, setRegs] = useState([]);
  const [officerClimbs, setOfficerClimbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payPromptReg, setPayPromptReg] = useState(null);

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
      ),
    )
      .then((snap) => {
        const sorted = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const da = a.startDate?.toDate?.() ?? new Date(a.startDate ?? 0);
            const db2 = b.startDate?.toDate?.() ?? new Date(b.startDate ?? 0);
            return da - db2;
          });
        setOfficerClimbs(sorted);
      })
      .catch((err) => {
        console.error("Officer climbs query failed:", err);
        logFailedRequest({
          type: "firestore",
          source: "MyRegistrations.jsx:officerClimbsQuery",
          message: err?.message,
          path: window.location.pathname,
          userId: currentUser.uid,
        });
      });
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
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
                      <span className={`status-badge status-${reg.status}`}>
                        {STATUS_LABEL[reg.status] || reg.status}
                      </span>
                      {reg.status !== "cancelled" &&
                        PAYMENT_LABEL[reg.paymentStatus] && (
                        <span
                          className={`status-badge status-payment-${reg.paymentStatus}`}
                        >
                          {PAYMENT_LABEL[reg.paymentStatus]}
                        </span>
                      )}
                    </div>
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
                    {reg.status !== "cancelled" &&
                      (reg.paymentStatus === "unpaid" ||
                        reg.paymentStatus === "rejected") && (
                        <button
                          className="btn btn-accent btn-sm"
                          onClick={() => setPayPromptReg(reg)}
                        >
                          Submit Payment
                        </button>
                      )}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </main>

      {payPromptReg && (
        <PayPrompt
          reg={payPromptReg}
          onClose={() => setPayPromptReg(null)}
          onSaved={() => setPayPromptReg(null)}
        />
      )}

      <Footer />
    </div>
  );
}
