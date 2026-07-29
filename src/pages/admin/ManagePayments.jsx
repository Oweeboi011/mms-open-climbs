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
  serverTimestamp,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { logAuditEvent } from "@/utils/auditLog";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import ClimbPaymentCard from "@/components/admin/ClimbPaymentCard";
import { StatBox } from "@/components/admin/paymentShared";
import {
  getExpectedTotal as getExpectedTotalShared,
  getOutstanding as getOutstandingShared,
  toggleTransportationEntry,
} from "@/utils/registrationFees";

const PAYMENT_STYLE = {
  unpaid: {
    bg: "#fce8e8",
    color: "#b91c1c",
    border: "#fca5a5",
    label: "Unpaid",
  },
  submitted: {
    bg: "#fef9e7",
    color: "#92400e",
    border: "#fcd34d",
    label: "Submitted",
  },
  verified: {
    bg: "#e8f5e9",
    color: "#1a6b2c",
    border: "#a7d7b2",
    label: "Verified",
  },
  rejected: {
    bg: "#fce8e8",
    color: "#b91c1c",
    border: "#fca5a5",
    label: "Rejected",
  },
};

function PayBadge({ status }) {
  const s = PAYMENT_STYLE[status];
  if (!s) return null;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 99,
        fontSize: "0.72rem",
        fontWeight: 700,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {s.label}
    </span>
  );
}


export default function ManagePayments() {
  const { currentUser } = useAuth();
  const [climbs, setClimbs] = useState([]);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedRegId, setExpandedRegId] = useState(null);
  const [qrUploading, setQrUploading] = useState(null);
  const [qrError, setQrError] = useState({});
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const fileRefs = useRef({});

  // Load climbs (once)
  useEffect(() => {
    getDocs(query(collection(db, "climbs"), orderBy("startDate", "asc"))).then(
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const da = a.startDate?.toDate?.() ?? new Date(a.startDate ?? 0);
            const db2 = b.startDate?.toDate?.() ?? new Date(b.startDate ?? 0);
            return da - db2;
          });
        setClimbs(list);
      },
    );
  }, []);

  // Live registrations
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "registrations"), orderBy("createdAt", "desc")),
      (snap) => {
        setRegs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  // Update climbs when Firestore QR changes
  function updateClimbLocally(climbId, patch) {
    setClimbs((prev) =>
      prev.map((c) => (c.id === climbId ? { ...c, ...patch } : c)),
    );
  }

  async function handleQrUpload(climbId, file) {
    if (!file) return;
    setQrUploading(climbId);
    setQrError((p) => ({ ...p, [climbId]: "" }));
    try {
      const sRef = storageRef(
        storage,
        `gcash-qr/${climbId}/${Date.now()}_${file.name}`,
      );
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
    const patch = { paymentStatus: status };
    if (status === "verified") {
      patch.verifiedAt = serverTimestamp();
      patch.verifiedBy = {
        uid: currentUser?.uid || null,
        name: currentUser?.displayName || currentUser?.email || "Admin",
      };
    }
    await updateDoc(doc(db, "registrations", regId), patch);
    const reg = regs.find((r) => r.id === regId);
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: `payment_status_${status}`,
      targetType: "registration",
      targetId: regId,
      targetLabel: reg?.name || reg?.climbTitle || regId,
      details: `Payment status set to "${status}"`,
    });
  }

  const climbById = useMemo(() => {
    const map = {};
    for (const c of climbs) map[c.id] = c;
    return map;
  }, [climbs]);

  // Toggle a registrant's transportation selection (availing organized
  // transport vs. arranging their own) directly from the payments table.
  // Falls back to the climb's current fee schedule when the registrant's own
  // feeBreakdown snapshot doesn't have a transportation line item yet (e.g.
  // they registered before the climb offered it), so every registrant on a
  // climb with a transportation fee gets a toggle, not just the ones whose
  // snapshot happens to include it.
  async function toggleTransportation(reg) {
    const climb = climbById[reg.climbId];
    const updated = toggleTransportationEntry(reg, climb);
    if (!updated) return;
    const nowSelected = updated.find((f) => /transport/i.test(f.label))?.selected;
    await updateDoc(doc(db, "registrations", reg.id), {
      feeBreakdown: updated,
      updatedAt: serverTimestamp(),
    });
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: "transportation_toggled",
      targetType: "registration",
      targetId: reg.id,
      targetLabel: reg.name || reg.id,
      details: `Transportation set to ${nowSelected ? "availing" : "own transport"}`,
    });
  }

  // Expected total / outstanding for a registration, from its own fee
  // snapshot if it has one, otherwise falling back to the climb's current
  // required fees.
  const getExpectedTotal = (reg) =>
    getExpectedTotalShared(reg, climbById[reg.climbId]);
  const getOutstanding = (reg) =>
    getOutstandingShared(reg, climbById[reg.climbId]);

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
          totalOutstanding: 0,
          transpoAvailed: 0,
          transpoOwn: 0,
        };
      }
      const s = map[reg.climbId];
      s.regs.push(reg);

      const paid =
        parseFloat(String(reg.amountPaid || 0).replace(/[^0-9.]/g, "")) || 0;
      s.totalDeclared += paid;
      if (reg.paymentStatus === "verified") s.totalVerified += paid;
      s.totalOutstanding += getOutstanding(reg);

      // Transportation breakdown from feeBreakdown
      const transpoItem = (reg.feeBreakdown || []).find((f) =>
        /transport/i.test(f.label),
      );
      if (transpoItem) {
        if (transpoItem.selected) s.transpoAvailed++;
        else s.transpoOwn++;
      } else {
        // No transpo item in breakdown — count as own
        s.transpoOwn++;
      }
    }
    return map;
  }, [regs, climbById]);

  const totalStats = useMemo(() => {
    let declared = 0,
      verified = 0,
      submitted = 0,
      outstanding = 0;
    for (const reg of regs) {
      if (reg.status === "cancelled") continue;
      const paid =
        parseFloat(String(reg.amountPaid || 0).replace(/[^0-9.]/g, "")) || 0;
      declared += paid;
      if (reg.paymentStatus === "verified") verified += paid;
      outstanding += getOutstanding(reg);
      if (reg.paymentStatus === "submitted") submitted++;
    }
    return { declared, verified, submitted, outstanding };
  }, [regs, climbById]);

  function fmt(n) {
    return (
      "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 0 })
    );
  }

  if (loading)
    return (
      <div className="admin-layout">
        <Header />
        <main className="admin-main">
          <LoadingSpinner />
        </main>
        <Footer />
      </div>
    );

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">
        {/* Lightbox */}
        {lightboxUrl && (
          <div
            onClick={() => setLightboxUrl(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.85)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "zoom-out",
            }}
          >
            <img
              src={lightboxUrl}
              alt="Proof"
              style={{ maxWidth: "92vw", maxHeight: "90vh", borderRadius: 8 }}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              style={{
                position: "fixed",
                top: 20,
                right: 24,
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: "50%",
                width: 40,
                height: 40,
                color: "#fff",
                fontSize: "1.2rem",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
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
            <div className="admin-page-subtitle">
              Cash flow, GCash QR, and transportation breakdown per climb
            </div>
          </div>
          <Link to="/admin" className="btn btn-outline btn-sm">
            &larr; Back to Admin
          </Link>
        </div>

        {/* Global summary */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 28,
          }}
        >
          <StatBox
            label="Total Declared"
            value={fmt(totalStats.declared)}
            sub="Sum of all amountPaid entries"
            color="var(--green-dark)"
          />
          <StatBox
            label="Verified Collected"
            value={fmt(totalStats.verified)}
            sub="Payment status = verified"
            color="#0070E0"
          />
          <StatBox
            label="Awaiting Review"
            value={totalStats.submitted}
            sub="Submitted, not yet verified"
            color="#e67e00"
          />
          <StatBox
            label="Total Outstanding"
            value={fmt(totalStats.outstanding)}
            sub="Expected fees not yet verified"
            color="#b91c1c"
          />
        </div>

        {/* Per-climb cards */}
        {climbs.length === 0 ? (
          <p style={{ color: "var(--ink-soft)" }}>No climbs found.</p>
        ) : (
          climbs.map((climb) => {
            const cs = climbStats[climb.id] || {
              regs: [],
              totalDeclared: 0,
              totalVerified: 0,
              transpoAvailed: 0,
              transpoOwn: 0,
            };
            return (
              <ClimbPaymentCard
                key={climb.id}
                climb={climb}
                cs={cs}
                expandedId={expandedId}
                setExpandedId={setExpandedId}
                expandedRegId={expandedRegId}
                setExpandedRegId={setExpandedRegId}
                qrUploading={qrUploading}
                qrError={qrError}
                fileRefs={fileRefs}
                handleQrUpload={handleQrUpload}
                changePaymentStatus={changePaymentStatus}
                toggleTransportation={toggleTransportation}
                getOutstanding={getOutstanding}
                setLightboxUrl={setLightboxUrl}
                fmt={fmt}
              />
            );
          })
        )}
      </main>
      <Footer />
    </div>
  );
}
