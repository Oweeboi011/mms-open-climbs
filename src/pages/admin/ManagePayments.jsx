import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/firebase/config";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";

const PAYMENT_STYLE = {
  submitted: { bg: "#fef9e7", color: "#92400e", border: "#fcd34d", label: "Submitted" },
  verified:  { bg: "#e8f5e9", color: "#1a6b2c", border: "#a7d7b2", label: "Verified" },
  rejected:  { bg: "#fce8e8", color: "#b91c1c", border: "#fca5a5", label: "Rejected" },
};

function PayBadge({ status }) {
  const s = PAYMENT_STYLE[status];
  if (!s) return null;
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 99,
      fontSize: "0.72rem", fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  );
}

function StatBox({ label, value, sub, color }) {
  return (
    <div style={{
      flex: "1 1 120px", padding: "14px 16px", borderRadius: 10,
      background: "var(--surface)", border: "1px solid var(--border)",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 900, color: color || "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--ink-soft)", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: "0.72rem", color: "var(--ink-soft)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function ManagePayments() {
  const [climbs, setClimbs] = useState([]);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [qrUploading, setQrUploading] = useState(null);
  const [qrError, setQrError] = useState({});
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const fileRefs = useRef({});

  // Load climbs (once)
  useEffect(() => {
    getDocs(query(collection(db, "climbs"), orderBy("startDate", "asc")))
      .then((snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const da = a.startDate?.toDate?.() ?? new Date(a.startDate ?? 0);
            const db2 = b.startDate?.toDate?.() ?? new Date(b.startDate ?? 0);
            return da - db2;
          });
        setClimbs(list);
      });
  }, []);

  // Live registrations
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "registrations"), orderBy("createdAt", "desc")),
      (snap) => {
        setRegs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  // Update climbs when Firestore QR changes
  function updateClimbLocally(climbId, patch) {
    setClimbs((prev) => prev.map((c) => c.id === climbId ? { ...c, ...patch } : c));
  }

  async function handleQrUpload(climbId, file) {
    if (!file) return;
    setQrUploading(climbId);
    setQrError((p) => ({ ...p, [climbId]: "" }));
    try {
      const sRef = storageRef(storage, `gcash-qr/${climbId}/${Date.now()}_${file.name}`);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      await updateDoc(doc(db, "climbs", climbId), { gcashQrUrl: url });
      updateClimbLocally(climbId, { gcashQrUrl: url });
    } catch (err) {
      setQrError((p) => ({ ...p, [climbId]: "Upload failed: " + err.message }));
    } finally {
      setQrUploading(null);
    }
  }

  async function changePaymentStatus(regId, status) {
    await updateDoc(doc(db, "registrations", regId), { paymentStatus: status });
  }

  // Per-climb stats derived from regs
  const climbStats = useMemo(() => {
    const map = {};
    for (const reg of regs) {
      if (!reg.climbId || reg.status === "cancelled") continue;
      if (!map[reg.climbId]) {
        map[reg.climbId] = {
          regs: [],
          totalDeclared: 0,
          totalVerified: 0,
          transpoAvailed: 0,
          transpoOwn: 0,
        };
      }
      const s = map[reg.climbId];
      s.regs.push(reg);

      const paid = parseFloat(String(reg.amountPaid || 0).replace(/[^0-9.]/g, "")) || 0;
      s.totalDeclared += paid;
      if (reg.paymentStatus === "verified") s.totalVerified += paid;

      // Transportation breakdown from feeBreakdown
      const transpoItem = (reg.feeBreakdown || []).find((f) => /transport/i.test(f.label));
      if (transpoItem) {
        if (transpoItem.selected) s.transpoAvailed++;
        else s.transpoOwn++;
      } else {
        // No transpo item in breakdown — count as own
        s.transpoOwn++;
      }
    }
    return map;
  }, [regs]);

  const totalStats = useMemo(() => {
    let declared = 0, verified = 0, submitted = 0;
    for (const reg of regs) {
      if (reg.status === "cancelled") continue;
      const paid = parseFloat(String(reg.amountPaid || 0).replace(/[^0-9.]/g, "")) || 0;
      declared += paid;
      if (reg.paymentStatus === "verified") verified += paid;
      if (reg.paymentStatus === "submitted") submitted++;
    }
    return { declared, verified, submitted };
  }, [regs]);

  function fmt(n) {
    return "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 0 });
  }

  if (loading) return (
    <div className="admin-layout"><Header /><main className="admin-main"><LoadingSpinner /></main><Footer /></div>
  );

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">

        {/* Lightbox */}
        {lightboxUrl && (
          <div
            onClick={() => setLightboxUrl(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}
          >
            <img src={lightboxUrl} alt="Proof" style={{ maxWidth: "92vw", maxHeight: "90vh", borderRadius: 8 }} onClick={(e) => e.stopPropagation()} />
            <button onClick={() => setLightboxUrl(null)} style={{ position: "fixed", top: 20, right: 24, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 40, height: 40, color: "#fff", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
          </div>
        )}

        <div className="admin-breadcrumb">
          <Link to="/admin">Dashboard</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>Payments</span>
        </div>

        <div className="admin-page-header">
          <div>
            <div className="admin-page-title">Manage Payments</div>
            <div className="admin-page-subtitle">Cash flow, GCash QR, and transportation breakdown per climb</div>
          </div>
        </div>

        {/* Global summary */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
          <StatBox label="Total Declared" value={fmt(totalStats.declared)} sub="Sum of all amountPaid entries" color="var(--green-dark)" />
          <StatBox label="Verified Collected" value={fmt(totalStats.verified)} sub="Payment status = verified" color="#0070E0" />
          <StatBox label="Awaiting Review" value={totalStats.submitted} sub="Submitted, not yet verified" color="#e67e00" />
        </div>

        {/* Per-climb cards */}
        {climbs.length === 0 ? (
          <p style={{ color: "var(--ink-soft)" }}>No climbs found.</p>
        ) : climbs.map((climb) => {
          const cs = climbStats[climb.id] || { regs: [], totalDeclared: 0, totalVerified: 0, transpoAvailed: 0, transpoOwn: 0 };
          const isOpen = expandedId === climb.id;
          const awaitingCount = cs.regs.filter((r) => r.paymentStatus === "submitted").length;
          const verifiedCount = cs.regs.filter((r) => r.paymentStatus === "verified").length;
          const rejectedCount = cs.regs.filter((r) => r.paymentStatus === "rejected").length;

          return (
            <div key={climb.id} style={{ marginBottom: 14, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
              {/* Climb header row */}
              <div
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", cursor: "pointer", background: isOpen ? "var(--surface)" : "#fff" }}
                onClick={() => setExpandedId(isOpen ? null : climb.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{climb.title}</div>
                  <div style={{ fontSize: "0.76rem", color: "var(--ink-soft)", marginTop: 1 }}>{climb.dateLabel} &bull; {climb.location}</div>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ textAlign: "center", minWidth: 60 }}>
                    <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "var(--green-dark)" }}>{fmt(cs.totalVerified)}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--ink-soft)", letterSpacing: 1.5, textTransform: "uppercase" }}>Verified</div>
                  </div>
                  <div style={{ textAlign: "center", minWidth: 60 }}>
                    <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "#e67e00" }}>{awaitingCount}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--ink-soft)", letterSpacing: 1.5, textTransform: "uppercase" }}>Pending</div>
                  </div>
                  <div style={{ fontSize: "1.2rem", color: "var(--ink-soft)", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none" }}>
                    ▾
                  </div>
                </div>
              </div>

              {/* Expanded body */}
              {isOpen && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "20px 20px 24px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>

                    {/* Cash flow */}
                    <div>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 10 }}>
                        Cash Flow
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <StatBox label="Total Declared" value={fmt(cs.totalDeclared)} color="var(--ink)" />
                        <StatBox label="Verified" value={fmt(cs.totalVerified)} color="var(--green-dark)" />
                        <StatBox label="Awaiting" value={awaitingCount} sub="payments to review" color="#e67e00" />
                        <StatBox label="Verified" value={verifiedCount} sub="payments confirmed" color="var(--green-dark)" />
                        <StatBox label="Rejected" value={rejectedCount} sub="payments rejected" color="#b91c1c" />
                      </div>
                    </div>

                    {/* Transportation breakdown */}
                    <div>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 10 }}>
                        Transportation
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                        <StatBox
                          label="Availing Transport"
                          value={cs.transpoAvailed}
                          sub="selected Transportation Fee"
                          color="#0070E0"
                        />
                        <StatBox
                          label="Own Transport"
                          value={cs.transpoOwn}
                          sub="not availing organized transport"
                          color="var(--ink-soft)"
                        />
                      </div>
                      {cs.regs.length > 0 && (
                        <div style={{ height: 8, borderRadius: 99, background: "var(--surface-alt)", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 99,
                            background: "#0070E0",
                            width: `${Math.round((cs.transpoAvailed / cs.regs.length) * 100)}%`,
                            transition: "width 0.3s",
                          }} />
                        </div>
                      )}
                      {cs.regs.length > 0 && (
                        <div style={{ fontSize: "0.72rem", color: "var(--ink-soft)", marginTop: 4 }}>
                          {Math.round((cs.transpoAvailed / cs.regs.length) * 100)}% availing organized transport
                        </div>
                      )}
                    </div>
                  </div>

                  {/* GCash QR management */}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18, marginBottom: 22 }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 12 }}>
                      GCash Payment Details
                    </div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
                      <div style={{ textAlign: "center" }}>
                        <img
                          src={climb.gcashQrUrl || "/gcash-qr-placeholder.svg"}
                          alt="GCash QR"
                          style={{ width: 130, height: 130, objectFit: "contain", border: "1px solid var(--border)", borderRadius: 8, background: "#fff", display: "block", cursor: climb.gcashQrUrl ? "zoom-in" : "default" }}
                          onClick={() => climb.gcashQrUrl && setLightboxUrl(climb.gcashQrUrl)}
                        />
                        <div style={{ fontSize: "0.68rem", color: "var(--ink-soft)", marginTop: 4 }}>
                          {climb.gcashQrUrl ? "Current QR" : "No QR uploaded"}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        {climb.gcashName && (
                          <div style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink-soft)" }}>Account Name</div>
                            <div style={{ fontWeight: 700 }}>{climb.gcashName}</div>
                          </div>
                        )}
                        {climb.gcashNumber && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink-soft)" }}>GCash Number</div>
                            <div style={{ fontWeight: 700, letterSpacing: 1 }}>{climb.gcashNumber}</div>
                          </div>
                        )}
                        <div>
                          <label style={{ fontSize: "0.78rem", fontWeight: 700, display: "block", marginBottom: 4 }}>
                            {climb.gcashQrUrl ? "Replace QR Code" : "Upload QR Code"}
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            ref={(el) => { fileRefs.current[climb.id] = el; }}
                            style={{ display: "none" }}
                            onChange={(e) => handleQrUpload(climb.id, e.target.files[0])}
                          />
                          <button
                            className="btn btn-outline btn-sm"
                            disabled={qrUploading === climb.id}
                            onClick={() => fileRefs.current[climb.id]?.click()}
                          >
                            {qrUploading === climb.id ? "Uploading…" : "📷 Choose Image"}
                          </button>
                          {qrError[climb.id] && (
                            <div style={{ fontSize: "0.78rem", color: "#b91c1c", marginTop: 6 }}>{qrError[climb.id]}</div>
                          )}
                          {!qrError[climb.id] && climb.gcashQrUrl && qrUploading !== climb.id && (
                            <div style={{ fontSize: "0.72rem", color: "var(--green-dark)", marginTop: 4 }}>✓ QR uploaded</div>
                          )}
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <Link to={`/admin/climbs/${climb.id}/edit`} className="btn btn-outline btn-sm">
                            Edit GCash Name / Number
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Participant payment list */}
                  <div>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: 10 }}>
                      Participant Payments ({cs.regs.length})
                    </div>
                    {cs.regs.length === 0 ? (
                      <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>No registrations yet.</p>
                    ) : (
                      <div className="admin-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Participant</th>
                              <th>Type</th>
                              <th>Transport</th>
                              <th>Declared Paid</th>
                              <th>Proof</th>
                              <th>Payment Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cs.regs.map((reg, idx) => {
                              const transpoItem = (reg.feeBreakdown || []).find((f) => /transport/i.test(f.label));
                              const hasTranspo = transpoItem?.selected;
                              return (
                                <tr key={reg.id}>
                                  <td style={{ color: "var(--ink-soft)", fontSize: "0.78rem" }}>{idx + 1}</td>
                                  <td>
                                    <div style={{ fontWeight: 600 }}>{reg.name}</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--ink-soft)" }}>{reg.email}</div>
                                  </td>
                                  <td style={{ fontSize: "0.78rem" }}>
                                    {reg.memberType === "member" ? "MMS Member" : "Joiner"}
                                  </td>
                                  <td style={{ fontSize: "0.82rem" }}>
                                    {transpoItem ? (
                                      hasTranspo
                                        ? <span style={{ color: "#0070E0", fontWeight: 700 }}>🚌 Availing</span>
                                        : <span style={{ color: "var(--ink-soft)" }}>Own</span>
                                    ) : (
                                      <span style={{ color: "var(--ink-soft)", fontStyle: "italic" }}>—</span>
                                    )}
                                  </td>
                                  <td style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                                    {reg.amountPaid ? fmt(reg.amountPaid) : <span style={{ color: "var(--ink-soft)" }}>—</span>}
                                  </td>
                                  <td>
                                    {reg.paymentProofs?.length > 0 ? (
                                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        {reg.paymentProofs.map((proof, i) => (
                                          proof.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                            <img
                                              key={i}
                                              src={proof.url}
                                              alt="proof"
                                              style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)", cursor: "zoom-in" }}
                                              onClick={() => setLightboxUrl(proof.url)}
                                            />
                                          ) : (
                                            <a key={i} href={proof.url} target="_blank" rel="noopener noreferrer"
                                              style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-alt)", textDecoration: "none", fontSize: "1.3rem" }}>
                                              📄
                                            </a>
                                          )
                                        ))}
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>—</span>
                                    )}
                                  </td>
                                  <td onClick={(e) => e.stopPropagation()}>
                                    <select
                                      className="form-select"
                                      style={{ padding: "4px 8px", fontSize: "0.75rem", width: "auto" }}
                                      value={reg.paymentStatus || "submitted"}
                                      onChange={(e) => changePaymentStatus(reg.id, e.target.value)}
                                    >
                                      <option value="submitted">Submitted</option>
                                      <option value="verified">Verified</option>
                                      <option value="rejected">Rejected</option>
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </main>
      <Footer />
    </div>
  );
}
