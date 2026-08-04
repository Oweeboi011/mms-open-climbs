import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  serverTimestamp,
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

// Shared by the on-page Fee Breakdown card and the pre-submit confirmation
// modal, so both always agree on the total.
function computeSelectedTotal(climb, reg, selections) {
  const hasClimbFees = climb?.fees?.length > 0;
  const required = hasClimbFees
    ? climb.fees.filter((e) => !e.optional)
    : (reg.feeBreakdown || []).filter((e) => !e.optional && e.selected);
  const optional = hasClimbFees ? climb.fees.filter((e) => e.optional) : [];
  let total = 0;
  let hasTba = false;
  const addAmount = (amt) => {
    const n = parseFloat(String(amt).replace(/[^0-9.]/g, ""));
    if (!isNaN(n)) total += n;
    else hasTba = true;
  };
  required.forEach((e) => addAmount(e.amount));
  optional.forEach((e) => {
    if (selections[e.label]) addAmount(e.amount);
  });
  return { total, hasTba };
}

function PayPrompt({ reg, onClose, onSaved }) {
  const [files, setFiles] = useState([]);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [climb, setClimb] = useState(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // Live selections for optional fees (transportation, guest fee, shirt,
  // etc.) so members can flip them on/off at payment time and see the total
  // update immediately, instead of being stuck with whatever was picked at
  // registration.
  const [selections, setSelections] = useState({});

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, "climbs", reg.climbId))
      .then((snap) => {
        if (!cancelled && snap.exists()) {
          setClimb(snap.data());
        }
      })
      .catch((err) => {
        logFailedRequest({
          type: "firestore",
          source: "MyRegistrations.jsx:PayPrompt:climbFetch",
          message: err?.message,
          path: window.location.pathname,
          climbId: reg.climbId,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reg.climbId]);

  useEffect(() => {
    if (!climb?.fees?.length) return;
    const initial = {};
    climb.fees.forEach((f) => {
      if (!f.optional) return;
      const stored = reg.feeBreakdown?.find((e) => e.label === f.label);
      if (stored) {
        initial[f.label] = !!stored.selected;
      } else if (f.isGuestFee) {
        initial[f.label] = reg.memberType === "joiner";
      } else {
        initial[f.label] = false;
      }
    });
    setSelections(initial);
  }, [climb, reg]);

  function toggleFee(label) {
    setSelections((p) => ({ ...p, [label]: !p[label] }));
  }

  function handleSubmit(e) {
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
    // Recap the climb and what happens next before actually writing anything.
    setShowConfirm(true);
  }

  async function doSubmit() {
    setShowConfirm(false);
    const parsedAmount = parseFloat(String(amount).replace(/[^0-9.]/g, ""));
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
      const feeBreakdown = climb?.fees?.length
        ? climb.fees.map((f) => ({
            label: f.label,
            amount: f.amount,
            optional: !!f.optional,
            selected: f.optional ? !!selections[f.label] : true,
          }))
        : reg.feeBreakdown;
      await updateDoc(doc(db, "registrations", reg.id), {
        paymentProofs: [...(reg.paymentProofs || []), ...paymentProofs],
        paymentStatus: "submitted",
        amountPaid: parsedAmount,
        paymentSubmittedAt: serverTimestamp(),
        // Clear any prior verification/rejection so the OR always reflects
        // the review of this latest submission, not a stale one.
        verifiedAt: null,
        verifiedBy: null,
        ...(feeBreakdown ? { feeBreakdown } : {}),
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
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>
          {reg.paymentStatus === "verified" ? "Add Fees / Pay More" : "Submit Payment"}
        </h3>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          For <strong>{reg.climbTitle}</strong>
          {reg.paymentStatus === "verified" && (
            <>
              {" "}— check any additional service you're now availing, then
              submit proof of the extra payment. This will move your payment
              back to "Awaiting Review" until it's re-verified.
            </>
          )}
        </p>
        {error && <div className="alert alert-error">{error}</div>}

        {reg.amountPaid > 0 && (
          <div
            style={{
              background: "var(--surface-alt)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: "0.82rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <strong>
                Already Paid: ₱{Number(reg.amountPaid).toLocaleString("en-PH")}
              </strong>
              <span
                className={`status-badge status-payment-${reg.paymentStatus}`}
              >
                {PAYMENT_LABEL[reg.paymentStatus] || reg.paymentStatus}
              </span>
            </div>
            {reg.paymentSubmittedAt && (
              <div style={{ color: "var(--ink-soft)" }}>
                Submitted: {formatDateTime(reg.paymentSubmittedAt)}
              </div>
            )}
            {reg.paymentStatus === "verified" && reg.verifiedAt && (
              <div style={{ color: "var(--ink-soft)" }}>
                Verified: {formatDateTime(reg.verifiedAt)}
                {reg.verifiedBy?.name ? ` by ${reg.verifiedBy.name}` : ""}
              </div>
            )}
            {reg.paymentProofs?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: "var(--ink-soft)", marginBottom: 4 }}>
                  Previously submitted:
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {reg.paymentProofs.map((proof, i) => (
                    <a
                      key={i}
                      href={proof.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "var(--green-dark)",
                        textDecoration: "underline",
                      }}
                    >
                      {proof.fileName || `Receipt ${i + 1}`}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {(reg.feeBreakdown?.length > 0 || climb?.fees?.length > 0) &&
          (() => {
            // Fees can change after a member registers (new items added,
            // "TBA" amounts filled in later) — always read the climb's
            // current fee schedule for labels/amounts so those updates are
            // reflected. Optional fees (transportation, guest fee, shirt,
            // etc.) are toggleable here so members can change their mind at
            // payment time and see the total update live.
            const hasClimbFees = climb?.fees?.length > 0;
            const required = hasClimbFees
              ? climb.fees.filter((e) => !e.optional)
              : reg.feeBreakdown.filter((e) => !e.optional && e.selected);
            const optional = hasClimbFees
              ? climb.fees.filter((e) => e.optional)
              : [];
            const { total, hasTba } = computeSelectedTotal(climb, reg, selections);
            const totalDisplay = hasTba
              ? `₱${total.toLocaleString("en-PH")} + TBA`
              : `₱${total.toLocaleString("en-PH")}`;
            return (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                    marginBottom: 6,
                  }}
                >
                  Fee Breakdown
                </div>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.85rem",
                  }}
                >
                  <tbody>
                    {required.map((e, i) => (
                      <tr
                        key={`req-${i}`}
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <td
                          style={{ padding: "6px 0" }}
                          colSpan={optional.length > 0 ? 2 : 1}
                        >
                          {e.label}
                          {e.note && (
                            <div
                              style={{
                                fontSize: "0.72rem",
                                color: "var(--ink-soft)",
                                marginTop: 2,
                              }}
                            >
                              {e.note}
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "6px 0",
                            textAlign: "right",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {e.amount || "TBA"}
                        </td>
                      </tr>
                    ))}
                    {optional.map((e, i) => {
                      const checked = !!selections[e.label];
                      return (
                        <tr
                          key={`opt-${i}`}
                          onClick={() => toggleFee(e.label)}
                          style={{
                            borderBottom: "1px solid var(--border)",
                            cursor: "pointer",
                            background: checked
                              ? "var(--surface-alt)"
                              : "transparent",
                          }}
                        >
                          <td
                            style={{
                              padding: "6px 4px 6px 0",
                              width: 20,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFee(e.label)}
                              onClick={(ev) => ev.stopPropagation()}
                            />
                          </td>
                          <td style={{ padding: "6px 0" }}>
                            {e.label}
                            {e.isGuestFee && (
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  color: "var(--ink-soft)",
                                  marginLeft: 4,
                                }}
                              >
                                (guest)
                              </span>
                            )}
                            {e.note && (
                              <div
                                style={{
                                  fontSize: "0.72rem",
                                  color: "var(--ink-soft)",
                                  marginTop: 2,
                                }}
                              >
                                {e.note}
                              </div>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "6px 0",
                              textAlign: "right",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {e.amount || "TBA"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid var(--border)" }}>
                      <td
                        style={{ padding: "8px 0", fontWeight: 800 }}
                        colSpan={optional.length > 0 ? 2 : 1}
                      >
                        Total
                      </td>
                      <td
                        style={{
                          padding: "8px 0",
                          textAlign: "right",
                          fontWeight: 900,
                          color: "var(--green-dark)",
                        }}
                      >
                        {totalDisplay}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                {optional.length > 0 && (
                  <p
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--ink-soft)",
                      marginTop: 6,
                    }}
                  >
                    Check or uncheck any optional item above to update your
                    total.
                  </p>
                )}
                {!hasClimbFees && (
                  <p
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--ink-soft)",
                      marginTop: 6,
                    }}
                  >
                    * Showing the fees recorded at registration — this
                    climb's fee schedule is no longer available.
                  </p>
                )}
              </div>
            );
          })()}

        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <img
              src={climb?.gcashQrUrl || "/gcash-qr-placeholder.svg"}
              alt="GCash QR Code"
              style={{
                width: 110,
                height: 110,
                objectFit: "contain",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "#fff",
                display: "block",
                cursor: "zoom-in",
                opacity: climb?.gcashQrUrl ? 1 : 0.75,
              }}
              onClick={() => setQrModalOpen(true)}
            />
            <div
              style={{
                fontSize: "0.68rem",
                color: "var(--ink-soft)",
                marginTop: 4,
              }}
            >
              {climb?.gcashQrUrl ? "Tap to enlarge & scan" : "QR code coming soon"}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 140, fontSize: "0.85rem" }}>
            {climb?.gcashName && (
              <div style={{ marginBottom: 6 }}>
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                  }}
                >
                  Account Name
                </div>
                <div style={{ fontWeight: 700 }}>{climb.gcashName}</div>
              </div>
            )}
            {climb?.gcashNumber && (
              <div style={{ marginBottom: 6 }}>
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                  }}
                >
                  GCash Number
                </div>
                <div style={{ fontWeight: 700 }}>{climb.gcashNumber}</div>
              </div>
            )}
            {!climb?.gcashQrUrl && !climb?.gcashNumber && !climb?.gcashName && (
              <div style={{ color: "var(--ink-soft)" }}>
                GCash details are being set up by the organizer. Please
                contact the climb officers.
              </div>
            )}
          </div>
        </div>

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

      {showConfirm &&
        (() => {
          const { total, hasTba } = computeSelectedTotal(climb, reg, selections);
          const totalDisplay = hasTba
            ? `₱${total.toLocaleString("en-PH")} + TBA`
            : `₱${total.toLocaleString("en-PH")}`;
          const parsedAmount = parseFloat(String(amount).replace(/[^0-9.]/g, ""));
          return (
            <div
              onClick={() => setShowConfirm(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1100,
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
                  Confirm Payment
                </h3>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--ink-soft)",
                    marginBottom: 16,
                  }}
                >
                  For <strong>{reg.climbTitle}</strong>
                </p>

                <div
                  style={{
                    background: "var(--surface-alt)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "12px 14px",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    <span>Total Fees Selected</span>
                    <span style={{ color: "var(--green-dark)" }}>
                      {totalDisplay}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.82rem",
                      color: "var(--ink-soft)",
                    }}
                  >
                    You're submitting{" "}
                    <strong>
                      ₱{isNaN(parsedAmount) ? 0 : parsedAmount.toLocaleString("en-PH")}
                    </strong>{" "}
                    via GCash. Your payment status will be set to{" "}
                    <strong>Awaiting Review</strong> until a climb officer
                    verifies it.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowConfirm(false)}
                    style={{ flex: 1 }}
                  >
                    Go Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={doSubmit}
                    style={{ flex: 1 }}
                  >
                    Confirm &amp; Submit
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {qrModalOpen && (
        <div
          onClick={() => setQrModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
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
              maxWidth: 340,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 4 }}>
              GCash QR Code
            </div>
            {climb?.gcashName && (
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
                  maxWidth: 260,
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
    </div>
  );
}

const RECEIPT_STATUS_LABEL = {
  submitted: "Awaiting Review",
  verified: "Verified",
  rejected: "Rejected",
};

function formatDateTime(value) {
  const d = value?.toDate?.() ?? (value ? new Date(value) : null);
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ReceiptModal({ reg, onClose }) {
  const items = (reg.feeBreakdown || []).filter((e) => e.selected);
  let total = 0;
  let hasTba = false;
  items.forEach((e) => {
    const n = parseFloat(String(e.amount).replace(/[^0-9.]/g, ""));
    if (!isNaN(n)) total += n;
    else hasTba = true;
  });
  const totalDisplay = hasTba
    ? `₱${total.toLocaleString("en-PH")} + TBA`
    : `₱${total.toLocaleString("en-PH")}`;
  const orNumber = `OR-${reg.id.slice(-8).toUpperCase()}`;

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
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 4,
          }}
        >
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Official Receipt</h3>
          <span
            className={`status-badge status-payment-${reg.paymentStatus}`}
          >
            {RECEIPT_STATUS_LABEL[reg.paymentStatus] || reg.paymentStatus}
          </span>
        </div>
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--ink-soft)",
            marginBottom: 16,
          }}
        >
          {orNumber}
        </p>

        <div className="reg-detail-grid" style={{ marginBottom: 16 }}>
          <div className="reg-detail-item">
            <span className="reg-detail-label">Climb</span>
            <strong>{reg.climbTitle}</strong>
          </div>
          <div className="reg-detail-item">
            <span className="reg-detail-label">Participant</span>
            <strong>{reg.name}</strong>
          </div>
        </div>

        {items.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "var(--ink-soft)",
                marginBottom: 6,
              }}
            >
              Fee Breakdown
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.85rem",
              }}
            >
              <tbody>
                {items.map((e, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 0" }}>{e.label}</td>
                    <td
                      style={{
                        padding: "6px 0",
                        textAlign: "right",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.amount || "TBA"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border)" }}>
                  <td style={{ padding: "8px 0", fontWeight: 800 }}>Total</td>
                  <td
                    style={{
                      padding: "8px 0",
                      textAlign: "right",
                      fontWeight: 900,
                      color: "var(--green-dark)",
                    }}
                  >
                    {totalDisplay}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="reg-detail-grid" style={{ marginBottom: 16 }}>
          <div className="reg-detail-item">
            <span className="reg-detail-label">Amount Paid</span>
            <strong>
              {reg.amountPaid
                ? `₱${Number(reg.amountPaid).toLocaleString("en-PH")}`
                : "—"}
            </strong>
          </div>
          <div className="reg-detail-item">
            <span className="reg-detail-label">Paid On</span>
            <strong>{formatDateTime(reg.paymentSubmittedAt)}</strong>
          </div>
          <div className="reg-detail-item">
            <span className="reg-detail-label">Confirmed On</span>
            <strong>
              {reg.paymentStatus === "verified"
                ? formatDateTime(reg.verifiedAt)
                : "—"}
            </strong>
          </div>
          <div className="reg-detail-item">
            <span className="reg-detail-label">Confirmed By</span>
            <strong>
              {reg.paymentStatus === "verified"
                ? reg.verifiedBy?.name || "—"
                : "—"}
            </strong>
          </div>
        </div>

        {reg.paymentProofs?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "var(--ink-soft)",
                marginBottom: 6,
              }}
            >
              Proof of Payment
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {reg.paymentProofs.map((proof, i) => (
                <a
                  key={i}
                  href={proof.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--green-dark)",
                    textDecoration: "underline",
                  }}
                >
                  {proof.fileName || `Receipt ${i + 1}`}
                </a>
              ))}
            </div>
          </div>
        )}

        <button
          className="btn btn-outline btn-sm"
          onClick={onClose}
          style={{ width: "100%" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function DocumentPrompt({ reg, climb, currentUser, onClose, onSaved }) {
  const needsForm = climb?.requiresRegistrationForm && !reg.registrationFormUpload;
  const needsCert = climb?.requiresMedicalCert && !reg.medicalCertUpload;

  const [formFile, setFormFile] = useState(null);
  const [certFile, setCertFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (needsForm && !formFile) {
      setError("Please upload your filled-out registration form.");
      return;
    }
    if (needsCert && !certFile) {
      setError("Please upload your medical certificate.");
      return;
    }

    setSaving(true);
    try {
      const patch = {};
      const timestamp = Date.now();
      if (needsForm) {
        const fileRef = storageRef(
          storage,
          `registration-form-uploads/${reg.climbId}/${reg.userId}/${timestamp}_${formFile.name}`,
        );
        await uploadBytes(fileRef, formFile);
        const url = await getDownloadURL(fileRef);
        patch.registrationFormUpload = { url, fileName: formFile.name };
      }
      if (needsCert) {
        const fileRef = storageRef(
          storage,
          `medical-cert-uploads/${reg.climbId}/${reg.userId}/${timestamp}_${certFile.name}`,
        );
        await uploadBytes(fileRef, certFile);
        const url = await getDownloadURL(fileRef);
        patch.medicalCertUpload = { url, fileName: certFile.name };
      }
      await updateDoc(doc(db, "registrations", reg.id), patch);
      onSaved();
    } catch (err) {
      setError("Failed to upload one of your files. Please try again.");
      logFailedRequest({
        type: "upload",
        source: "MyRegistrations.jsx:DocumentPrompt",
        message: err?.message,
        path: window.location.pathname,
        userId: currentUser?.uid,
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
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>
          Submit Required Documents
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
          {needsForm && (
            <div className="form-group">
              <label className="form-label required">
                Signed Registration Form
              </label>
              {climb?.registrationFormUrl && (
                <div style={{ marginBottom: 8 }}>
                  <a
                    href={climb.registrationFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    &#128196; Download Registration Form
                  </a>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                className="form-input"
                onChange={(e) => setFormFile(e.target.files[0] || null)}
              />
              <div className="form-hint">
                Download the form above, fill it out, then upload your copy
                here.
              </div>
            </div>
          )}

          {needsCert && (
            <div className="form-group">
              <label className="form-label required">
                Medical Certificate
              </label>
              {climb?.medicalCertSampleUrl && (
                <div style={{ marginBottom: 8 }}>
                  <a
                    href={climb.medicalCertSampleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    &#128196; View Sample Medical Certificate
                  </a>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                className="form-input"
                onChange={(e) => setCertFile(e.target.files[0] || null)}
              />
              <div className="form-hint">
                Upload your own medical certificate from a licensed
                physician.
              </div>
            </div>
          )}

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

function OfficerCard({ climb, currentUser }) {
  const myEntry = (climb.officers || []).find(
    (o) => o.userId === currentUser.uid,
  );
  return (
    <div className="reg-card">
      <div className="reg-card-header">
        <div>
          <div className="reg-card-title">{climb.title}</div>
          <div className="reg-card-date">
            &#128197; {climb.dateLabel} &nbsp;|&nbsp; &#128205; {climb.location}
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
        <Link to={`/event/${climb.id}`} className="btn btn-outline btn-sm">
          View Climb
        </Link>
        <Link to={`/admin/climbs/${climb.id}`} className="btn btn-primary btn-sm">
          Registrants
        </Link>
      </div>
    </div>
  );
}

function RegCard({ reg, climb, onPay, onViewReceipt, onSubmitDocs, isPast }) {
  const needsForm = climb?.requiresRegistrationForm && !reg.registrationFormUpload;
  const needsCert = climb?.requiresMedicalCert && !reg.medicalCertUpload;
  return (
    <div className="reg-card" data-status={reg.status}>
      <div className="reg-card-header">
        <div>
          <div className="reg-card-title">{reg.climbTitle}</div>
          <div className="reg-card-date">
            &#128197; {reg.climbDate} &nbsp;|&nbsp; &#128205; {reg.climbLocation}
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
          {reg.status !== "cancelled" && PAYMENT_LABEL[reg.paymentStatus] && (
            <span className={`status-badge status-payment-${reg.paymentStatus}`}>
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
            <span className="reg-detail-label">Emergency Contact</span>
            <strong>{reg.emergencyContact?.name}</strong> (
            {reg.emergencyContact?.relationship})
          </div>
          <div className="reg-detail-item">
            <span className="reg-detail-label">Registered</span>
            <strong>
              {reg.createdAt?.toDate?.().toLocaleDateString("en-PH") || "—"}
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
        <Link to={`/event/${reg.climbId}`} className="btn btn-outline btn-sm">
          View Climb
        </Link>
        {reg.waiverSigned && (
          <Link to={`/waiver/${reg.id}`} className="btn btn-primary btn-sm">
            Print Waiver
          </Link>
        )}
        {reg.status !== "cancelled" &&
          (reg.paymentStatus === "unpaid" || reg.paymentStatus === "rejected") && (
            <button className="btn btn-accent btn-sm" onClick={onPay}>
              Submit Payment
            </button>
          )}
        {reg.status !== "cancelled" && reg.paymentStatus === "verified" && (
          <button
            className="btn btn-outline btn-sm"
            onClick={onPay}
            title="Availing an extra service (e.g. transportation)? Add it here and submit the additional payment."
          >
            Add Fees / Pay More
          </button>
        )}
        {(reg.paymentStatus === "submitted" ||
          reg.paymentStatus === "verified" ||
          reg.paymentStatus === "rejected") && (
          <button
            className="btn btn-outline btn-sm"
            onClick={onViewReceipt}
          >
            View OR
          </button>
        )}
        {reg.status !== "cancelled" && (needsForm || needsCert) && (
          <button className="btn btn-accent btn-sm" onClick={onSubmitDocs}>
            {needsForm && needsCert
              ? "Submit Required Documents"
              : needsForm
                ? "Submit Registration Form"
                : "Submit Medical Certificate"}
          </button>
        )}
        {isPast && reg.status === "confirmed" && (
          <Link
            to={`/feedback/${reg.climbId}`}
            className="btn btn-gold btn-sm"
          >
            Leave Feedback
          </Link>
        )}
      </div>
    </div>
  );
}

export default function MyRegistrations() {
  const { currentUser } = useAuth();
  const [regs, setRegs] = useState([]);
  const [climbsMap, setClimbsMap] = useState({});
  const [officerClimbs, setOfficerClimbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payPromptReg, setPayPromptReg] = useState(null);
  const [receiptReg, setReceiptReg] = useState(null);
  const [docPromptReg, setDocPromptReg] = useState(null);

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
    const climbIds = [...new Set(regs.map((r) => r.climbId))].filter(Boolean);
    if (climbIds.length === 0) return;
    Promise.all(
      climbIds.map((id) =>
        getDoc(doc(db, "climbs", id)).then((snap) => [
          id,
          snap.exists() ? snap.data() : null,
        ]),
      ),
    )
      .then((entries) => {
        setClimbsMap(Object.fromEntries(entries));
      })
      .catch((err) => {
        logFailedRequest({
          type: "firestore",
          source: "MyRegistrations.jsx:climbsFetch",
          message: err?.message,
          path: window.location.pathname,
          userId: currentUser.uid,
        });
      });
  }, [regs, currentUser.uid]);

  // climb.startDate/endDate may be a Firestore Timestamp OR a plain
  // "YYYY-MM-DD" string (from the admin date picker) — handle both.
  const toDateSafe = (value) => {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };
  // A climb is only "past" once its whole event day has elapsed.
  const eventEndOf = (climb) => {
    const raw = climb?.endDate || climb?.startDate;
    const d = toDateSafe(raw);
    if (!d) return null;
    d.setHours(23, 59, 59, 999);
    return d;
  };
  const eventStartOf = (climb) => toDateSafe(climb?.startDate);

  const now = new Date();

  const upcomingRegs = [];
  const pastRegs = [];
  regs.forEach((reg) => {
    const eventEnd = eventEndOf(climbsMap[reg.climbId]);
    if (eventEnd && eventEnd < now) {
      pastRegs.push(reg);
    } else {
      upcomingRegs.push(reg);
    }
  });
  const byEventDateAsc = (a, b) => {
    const da = eventStartOf(climbsMap[a.climbId]) ?? new Date(8640000000000000);
    const dbb = eventStartOf(climbsMap[b.climbId]) ?? new Date(8640000000000000);
    return da - dbb;
  };
  upcomingRegs.sort(byEventDateAsc);
  pastRegs.sort(byEventDateAsc);

  const upcomingOfficerClimbs = [];
  const pastOfficerClimbs = [];
  officerClimbs.forEach((climb) => {
    const eventEnd = eventEndOf(climb);
    if (eventEnd && eventEnd < now) {
      pastOfficerClimbs.push(climb);
    } else {
      upcomingOfficerClimbs.push(climb);
    }
  });
  const byClimbDateAsc = (a, b) => {
    const da = eventStartOf(a) ?? new Date(8640000000000000);
    const dbb = eventStartOf(b) ?? new Date(8640000000000000);
    return da - dbb;
  };
  upcomingOfficerClimbs.sort(byClimbDateAsc);
  pastOfficerClimbs.sort(byClimbDateAsc);

  const unpaidRegs = regs.filter(
    (reg) =>
      reg.status !== "cancelled" &&
      (reg.paymentStatus === "unpaid" || reg.paymentStatus === "rejected"),
  );
  const cancelledRegs = regs.filter((reg) => reg.status === "cancelled");

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
            <div className="admin-stats" style={{ marginBottom: 28 }}>
              <div className="admin-stat-card">
                <div className="admin-stat-num">{pastRegs.length}</div>
                <div className="admin-stat-label">Climbs Completed</div>
              </div>
              <div className="admin-stat-card accent">
                <div className="admin-stat-num">{upcomingRegs.length}</div>
                <div className="admin-stat-label">Upcoming Climbs</div>
              </div>
              <div className="admin-stat-card gold">
                <div className="admin-stat-num">{pastOfficerClimbs.length}</div>
                <div className="admin-stat-label">Climbs as Officer</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-num">{upcomingOfficerClimbs.length}</div>
                <div className="admin-stat-label">Tagged as Officer</div>
              </div>
              <div className="admin-stat-card danger">
                <div className="admin-stat-num">{unpaidRegs.length}</div>
                <div className="admin-stat-label">Unpaid Climbs</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-num">{cancelledRegs.length}</div>
                <div className="admin-stat-label">Cancelled Climbs</div>
              </div>
            </div>

            {regs.length === 0 ? (
              <>
                <h2 className="myreg-section-title">My Registrations</h2>
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
              </>
            ) : (
              <>
                <h2 className="myreg-section-title">Upcoming Climbs</h2>
                {upcomingRegs.length === 0 ? (
                  <div className="alert alert-info" style={{ marginBottom: 36 }}>
                    No upcoming registrations.
                  </div>
                ) : (
                  <div style={{ marginBottom: 36 }}>
                    {upcomingRegs.map((reg) => (
                      <RegCard
                        key={reg.id}
                        reg={reg}
                        climb={climbsMap[reg.climbId]}
                        onPay={() => setPayPromptReg(reg)}
                        onViewReceipt={() => setReceiptReg(reg)}
                        onSubmitDocs={() => setDocPromptReg(reg)}
                      />
                    ))}
                  </div>
                )}

                {pastRegs.length > 0 && (
                  <details>
                    <summary className="myreg-section-title myreg-collapsible">
                      Past Climbs ({pastRegs.length})
                    </summary>
                    <div style={{ marginTop: 12 }}>
                      {pastRegs.map((reg) => (
                        <RegCard
                          key={reg.id}
                          reg={reg}
                          climb={climbsMap[reg.climbId]}
                          onPay={() => setPayPromptReg(reg)}
                          onViewReceipt={() => setReceiptReg(reg)}
                          onSubmitDocs={() => setDocPromptReg(reg)}
                          isPast
                        />
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}

            {officerClimbs.length > 0 && (
              <div style={{ marginTop: 36 }}>
                <h2 className="myreg-section-title">
                  Assigned as Officer — Upcoming
                </h2>
                {upcomingOfficerClimbs.length === 0 ? (
                  <div className="alert alert-info" style={{ marginBottom: 24 }}>
                    No upcoming climbs assigned.
                  </div>
                ) : (
                  <div style={{ marginBottom: 24 }}>
                    {upcomingOfficerClimbs.map((climb) => (
                      <OfficerCard
                        key={climb.id}
                        climb={climb}
                        currentUser={currentUser}
                      />
                    ))}
                  </div>
                )}

                {pastOfficerClimbs.length > 0 && (
                  <details>
                    <summary className="myreg-section-title myreg-collapsible">
                      Assigned as Officer — Past ({pastOfficerClimbs.length})
                    </summary>
                    <div style={{ marginTop: 12 }}>
                      {pastOfficerClimbs.map((climb) => (
                        <OfficerCard
                          key={climb.id}
                          climb={climb}
                          currentUser={currentUser}
                        />
                      ))}
                    </div>
                  </details>
                )}
              </div>
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

      {receiptReg && (
        <ReceiptModal reg={receiptReg} onClose={() => setReceiptReg(null)} />
      )}

      {docPromptReg && (
        <DocumentPrompt
          reg={docPromptReg}
          climb={climbsMap[docPromptReg.climbId]}
          currentUser={currentUser}
          onClose={() => setDocPromptReg(null)}
          onSaved={() => setDocPromptReg(null)}
        />
      )}

      <Footer />
    </div>
  );
}
