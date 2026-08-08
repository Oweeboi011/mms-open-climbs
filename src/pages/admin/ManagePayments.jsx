import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
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
  getOutstanding as getOutstandingShared,
  toggleOptionalFeeEntry,
  getAvailmentCounts,
} from "@/utils/registrationFees";
import { setEntryStatus, setAllEntryStatuses } from "@/utils/payments";
import { groupClimbsByCompletion } from "@/utils/climbGrouping";

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

  // Live climbs — every expected/outstanding figure on this page is computed
  // from the climb's current fee schedule, so a fee edited elsewhere has to
  // land here without a reload.
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "climbs"), orderBy("startDate", "asc")),
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
    return unsub;
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

  // Applies one verdict to every payment on the registration, so the rolled-
  // up status can't disagree with the individual payments behind it.
  // Who's making the verdict, stamped onto each payment it touches.
  function reviewer() {
    return {
      uid: currentUser?.uid,
      name: currentUser?.displayName || currentUser?.email || "admin",
      at: Timestamp.now(),
    };
  }

  async function changePaymentStatus(regId, status) {
    const patch = setAllEntryStatuses(
      regs.find((r) => r.id === regId) || {},
      status,
      reviewer(),
    );
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

  // Review one payment on its own — an officer can accept the downpayment
  // and bounce only the instalment with the unreadable receipt.
  async function changeEntryStatus(reg, index, status) {
    await updateDoc(doc(db, "registrations", reg.id), {
      ...setEntryStatus(reg, index, status, reviewer()),
    });
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: `payment_entry_${status}`,
      targetType: "registration",
      targetId: reg.id,
      targetLabel: reg.name || reg.climbTitle || reg.id,
      details: `Payment ${index + 1} set to "${status}"`,
    });
  }

  const climbById = useMemo(() => {
    const map = {};
    for (const c of climbs) map[c.id] = c;
    return map;
  }, [climbs]);

  // Toggle whether a registrant is availing one of the climb's optional
  // services from the payments table. Falls back to the climb's current fee
  // schedule when the registrant's own feeBreakdown snapshot doesn't have
  // that line item yet (e.g. they registered before the climb offered it),
  // so every registrant gets a toggle, not just the ones whose snapshot
  // happens to include it.
  async function toggleOptionalFee(reg, label) {
    const climb = climbById[reg.climbId];
    const updated = toggleOptionalFeeEntry(reg, climb, label);
    if (!updated) return;
    const nowSelected = updated.find((f) => f.label === label)?.selected;
    await updateDoc(doc(db, "registrations", reg.id), {
      feeBreakdown: updated,
      updatedAt: serverTimestamp(),
    });
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: "optional_fee_toggled",
      targetType: "registration",
      targetId: reg.id,
      targetLabel: reg.name || reg.id,
      details: `${label} set to ${nowSelected ? "availing" : "not availing"}`,
    });
  }

  // Outstanding for a registration, always against its climb's current fee
  // schedule (the snapshot on the registration only says which optional items
  // they picked) — see utils/registrationFees.js.
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
        };
      }
      const s = map[reg.climbId];
      s.regs.push(reg);

      const paid =
        parseFloat(String(reg.amountPaid || 0).replace(/[^0-9.]/g, "")) || 0;
      s.totalDeclared += paid;
      if (reg.paymentStatus === "verified") s.totalVerified += paid;
      s.totalOutstanding += getOutstanding(reg);
    }
    // Headcount per optional service the climb offers — what the organisers
    // book vans and porters against. Derived from the climb's own fee
    // schedule, so a newly added service is counted with no code change.
    for (const [climbId, s] of Object.entries(map)) {
      s.availment = getAvailmentCounts(s.regs, climbById[climbId]);
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

  const { upcoming: upcomingClimbs, completed: completedClimbs } = useMemo(
    () => groupClimbsByCompletion(climbs),
    [climbs],
  );

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

        {/* Per-climb cards, upcoming first — collecting payments for a climb
            that hasn't happened yet is the live work; completed climbs are
            kept below for reconciliation. */}
        {climbs.length === 0 ? (
          <p style={{ color: "var(--ink-soft)" }}>No climbs found.</p>
        ) : (
          <>
            {[
              { title: "Upcoming Climbs", list: upcomingClimbs },
              { title: "Completed Climbs", list: completedClimbs },
            ].map(({ title, list }) => (
              <section key={title} style={{ marginBottom: 22 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    margin: "0 0 10px",
                  }}
                >
                  <h2
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: "var(--ink-soft)",
                      margin: 0,
                    }}
                  >
                    {title}
                  </h2>
                  <span
                    style={{ fontSize: "0.72rem", color: "var(--ink-soft)" }}
                  >
                    {list.length}
                  </span>
                </div>
                {list.length === 0 ? (
                  <p
                    style={{
                      color: "var(--ink-soft)",
                      fontSize: "0.85rem",
                      margin: "0 0 4px",
                    }}
                  >
                    None.
                  </p>
                ) : (
                  list.map((climb) => {
                    const cs = climbStats[climb.id] || {
                      regs: [],
                      totalDeclared: 0,
                      totalVerified: 0,
                      totalOutstanding: 0,
                      availment: [],
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
                        onEntryStatusChange={changeEntryStatus}
                        toggleOptionalFee={toggleOptionalFee}
                        getOutstanding={getOutstanding}
                        setLightboxUrl={setLightboxUrl}
                        fmt={fmt}
                      />
                    );
                  })
                )}
              </section>
            ))}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
