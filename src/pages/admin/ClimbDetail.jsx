import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import JSZip from "jszip";
import {
  doc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import EditRegistrationModal from "@/components/EditRegistrationModal";
import RegistrantRow from "@/components/admin/RegistrantRow";
import { detailsIncomplete } from "@/components/DetailsPrompt";
import AddJoinerModal from "@/components/admin/AddJoinerModal";
import CollectionBreakdown from "@/components/admin/CollectionBreakdown";
import RecordPaymentModal from "@/components/admin/RecordPaymentModal";
import AdminDocumentModal from "@/components/admin/AdminDocumentModal";
import ReceiptModal from "@/components/ReceiptModal";
import { STATUS_OPTIONS } from "@/components/admin/registrantShared";
import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";
import {
  sanitizeFileNamePart,
  makeDatedDownloadName,
} from "@/utils/downloadFileName";
import { getDocCompliance } from "@/utils/docCompliance";
import { logAuditEvent } from "@/utils/auditLog";
import { recordManualPayment } from "@/utils/recordPayment";
import {
  getOutstanding as getOutstandingShared,
  toggleOptionalFeeEntry,
  describeMemberTypeChange,
} from "@/utils/registrationFees";
import {
  getPaymentEntries,
  setEntryStatus,
  setAllEntryStatuses,
} from "@/utils/payments";
import ResponsiveTable from "@/components/admin/ResponsiveTable";

// What the Compliance column of the registrants table shows, as a list of the
// gaps rather than ticks — the waiver, the participant's own details, and each
// document this climb switched on. Filtering reads off the same source as the
// column so a chosen filter can never disagree with the ✕ an admin is looking
// at.
function missingCompliance(reg, climb) {
  const missing = [];
  if (!reg.waiverSigned) missing.push("waiver");
  if (detailsIncomplete(reg)) missing.push("details");
  REQUIRED_DOC_TYPES.forEach((docType) => {
    if (climb?.[docType.requiresField] && !reg[docType.uploadField]?.url) {
      missing.push(`doc:${docType.key}`);
    }
  });
  return missing;
}

export default function AdminClimbDetail() {
  const { id } = useParams();
  const { currentUser } = useAuth();

  const [climb, setClimb] = useState(null);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterCompliance, setFilterCompliance] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [editNotes, setEditNotes] = useState({});
  const [savingNote, setSavingNote] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [addJoinerOpen, setAddJoinerOpen] = useState(false);
  const [editingReg, setEditingReg] = useState(null);
  const [recordingPaymentFor, setRecordingPaymentFor] = useState(null);
  const [viewingReceiptFor, setViewingReceiptFor] = useState(null);
  const [managingDocsFor, setManagingDocsFor] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [zippingDocs, setZippingDocs] = useState(false);

  useEffect(() => {
    // Live, not a one-shot read: every expected/outstanding figure on this
    // page comes from the climb's current fee schedule, so a fee edited
    // elsewhere has to land here without a reload.
    const unsubClimb = onSnapshot(doc(db, "climbs", id), (snap) => {
      if (snap.exists()) setClimb({ id: snap.id, ...snap.data() });
    });

    const q = query(
      collection(db, "registrations"),
      where("climbId", "==", id),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setRegs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const feedbackQ = query(
      collection(db, "feedback"),
      where("climbId", "==", id),
    );
    const unsubFeedback = onSnapshot(feedbackQ, (snap) => {
      setFeedback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubClimb();
      unsub();
      unsubFeedback();
    };
  }, [id]);

  async function changeStatus(regId, status) {
    await updateDoc(doc(db, "registrations", regId), {
      status,
      updatedAt: serverTimestamp(),
      ...(status === "confirmed" ? { confirmedAt: serverTimestamp() } : {}),
    });
    const reg = regs.find((r) => r.id === regId);
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: `registration_status_${status}`,
      targetType: "registration",
      targetId: regId,
      targetLabel: reg?.name || regId,
      details: `Status set to "${status}" for ${climb?.title || "climb"}`,
    });
  }

  // Who's making a payment verdict, stamped onto each entry it touches.
  // Timestamped client-side because serverTimestamp() can't go in an array.
  function reviewer() {
    return {
      uid: currentUser?.uid,
      name: currentUser?.displayName || currentUser?.email || "admin",
      at: Timestamp.now(),
    };
  }

  // The registration-level verdict — applies to every payment on record, so
  // the rolled-up status and the individual payments can't disagree.
  async function changePaymentStatus(regId, paymentStatus) {
    const reg = regs.find((r) => r.id === regId);
    await updateDoc(doc(db, "registrations", regId), {
      ...setAllEntryStatuses(reg || {}, paymentStatus, reviewer()),
      updatedAt: serverTimestamp(),
    });
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: `payment_status_${paymentStatus}`,
      targetType: "registration",
      targetId: regId,
      targetLabel: reg?.name || regId,
      details: `Payment status set to "${paymentStatus}" for ${climb?.title || "climb"}`,
    });
  }

  // Review a single payment without touching the others — the registration's
  // own status re-derives from whatever the payments now say.
  async function changeEntryStatus(reg, index, status) {
    await updateDoc(doc(db, "registrations", reg.id), {
      ...setEntryStatus(reg, index, status, reviewer()),
      updatedAt: serverTimestamp(),
    });
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: `payment_entry_${status}`,
      targetType: "registration",
      targetId: reg.id,
      targetLabel: reg.name || reg.id,
      details: `Payment ${index + 1} set to "${status}" for ${climb?.title || "climb"}`,
    });
  }

  async function recordPayment(reg, entry) {
    await recordManualPayment(reg, entry, {
      currentUser,
      climbTitle: climb?.title,
    });
    setRecordingPaymentFor(null);
  }

  async function saveAdminDocs(reg, patch) {
    await updateDoc(doc(db, "registrations", reg.id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: "documents_submitted_by_admin",
      targetType: "registration",
      targetId: reg.id,
      targetLabel: reg.name || reg.id,
      details: Object.keys(patch).join(", "),
    });
    setManagingDocsFor(null);
  }

  // Toggle whether a registrant is availing one of the climb's optional
  // services (transportation, porter, …) from the registrants table. Falls
  // back to the climb's fee schedule when the registrant's own feeBreakdown
  // snapshot doesn't have that line item yet.
  async function toggleOptionalFee(reg, label) {
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
      details: `${label} set to ${nowSelected ? "availing" : "not availing"} for ${climb?.title || "climb"}`,
    });
  }

  async function saveRegistrationEdit(regId, patch) {
    await updateDoc(doc(db, "registrations", regId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    const reg = regs.find((r) => r.id === regId);
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: "registration_edited",
      targetType: "registration",
      targetId: regId,
      targetLabel: reg?.name || regId,
      details:
        `Edited registration for ${climb?.title || "climb"}` +
        describeMemberTypeChange(reg, patch),
    });
    setEditingReg(null);
  }

  async function deleteRegistration(reg) {
    if (
      !window.confirm(
        `Delete registration for "${reg.name}"? This cannot be undone.`,
      )
    )
      return;
    await deleteDoc(doc(db, "registrations", reg.id));
    if (expandedId === reg.id) setExpandedId(null);
    logAuditEvent({
      actorUid: currentUser?.uid,
      actorName: currentUser?.displayName || currentUser?.email,
      action: "registration_deleted",
      targetType: "registration",
      targetId: reg.id,
      targetLabel: reg.name || reg.id,
      details: `Deleted registration for ${climb?.title || "climb"}`,
    });
  }

  function toggleExpand(regId) {
    setExpandedId((prev) => (prev === regId ? null : regId));
  }

  function startNoteEdit(reg) {
    setEditNotes((prev) => ({
      ...prev,
      [reg.id]: prev[reg.id] ?? (reg.adminNotes || ""),
    }));
  }

  async function saveNote(regId) {
    setSavingNote(regId);
    try {
      await updateDoc(doc(db, "registrations", regId), {
        adminNotes: editNotes[regId],
        updatedAt: serverTimestamp(),
      });
      setEditNotes((prev) => {
        const n = { ...prev };
        delete n[regId];
        return n;
      });
    } finally {
      setSavingNote(null);
    }
  }

  function exportCSV() {
    const headers = [
      "#",
      "Name",
      "Email",
      "Mobile",
      "Date of Birth",
      "Address",
      "Experience",
      "Type",
      "EC Name",
      "EC Relationship",
      "EC Mobile",
      "Medical Conditions",
      "Status",
      "Payment Status",
      "Amount Paid",
      "Payment Breakdown",
      "Payment Submitted",
      "Payment Verified",
      "Verified By",
      "Registration Form Uploaded",
      "Medical Cert Uploaded",
      "Waiver Signed As",
      "Waiver Date",
      "Registered",
      "Admin Notes",
    ];
    const rows = regs.map((r, i) => [
      i + 1,
      r.name,
      r.email,
      r.mobile,
      r.dateOfBirth || "",
      r.address || "",
      r.experienceLevel,
      r.memberType || "",
      r.emergencyContact?.name || "",
      r.emergencyContact?.relationship || "",
      r.emergencyContact?.mobile || "",
      r.medicalConditions || "",
      r.status,
      r.paymentStatus || "",
      r.amountPaid ?? "",
      getPaymentEntries(r)
        .map((p) => {
          const when =
            p.submittedAt?.toDate?.().toLocaleDateString("en-PH") || "";
          return `${p.amount}${when ? ` on ${when}` : ""}${p.note ? ` (${p.note})` : ""}`;
        })
        .join("; "),
      r.paymentSubmittedAt?.toDate?.().toLocaleDateString("en-PH") || "",
      r.paymentStatus === "verified"
        ? r.verifiedAt?.toDate?.().toLocaleDateString("en-PH") || ""
        : "",
      r.paymentStatus === "verified" ? r.verifiedBy?.name || "" : "",
      r.registrationFormUpload?.url ? "Yes" : "No",
      r.medicalCertUpload?.url ? "Yes" : "No",
      r.waiverSignedName || "",
      r.waiverSignedAt?.toDate?.().toLocaleDateString("en-PH") || "",
      r.createdAt?.toDate?.().toLocaleDateString("en-PH") || "",
      r.adminNotes || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${climb?.title || "registrants"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadAllDocs() {
    // Every doc type in REQUIRED_DOC_TYPES, not a hardcoded pair — a climb
    // that requires a permit or waiver doc has to come out of here too. An
    // upload is collected whenever it exists, even if the climb's requires
    // toggle was since turned off, so nothing already handed in is dropped.
    const docs = [];
    regs.forEach((r, i) => {
      const safeName =
        sanitizeFileNamePart(r.name, `registrant-${i + 1}`) +
        (r.id ? ` (${r.id.slice(-6)})` : "");
      REQUIRED_DOC_TYPES.forEach((docType) => {
        const upload = r[docType.uploadField];
        if (!upload?.url) return;
        docs.push({
          folder: safeName,
          url: upload.url,
          // Prefixed so the four docs of one registrant stay distinguishable
          // inside their folder even when the source files share a name.
          fileName: sanitizeFileNamePart(
            `${docType.badgeLabel} - ${upload.fileName || docType.key}`,
            docType.key,
          ),
        });
      });
    });

    if (!docs.length) {
      alert("No uploaded requirement documents found for this climb yet.");
      return;
    }

    setZippingDocs(true);
    try {
      const zip = new JSZip();
      let failed = 0;
      await Promise.all(
        docs.map(async (d) => {
          try {
            const res = await fetch(d.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            zip.file(`${d.folder}/${d.fileName}`, await res.blob());
          } catch (err) {
            failed += 1;
            console.error(`Failed to fetch ${d.folder}/${d.fileName}:`, err);
          }
        }),
      );
      if (failed === docs.length) {
        alert("Failed to download documents. Please try again.");
        return;
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = makeDatedDownloadName(
        climb?.title || "climb",
        "requirement-docs",
        "zip",
      );
      a.click();
      URL.revokeObjectURL(url);
      if (failed) {
        alert(
          `${failed} of ${docs.length} document${failed === 1 ? "" : "s"} could not be downloaded and ${failed === 1 ? "is" : "are"} missing from the ZIP.`,
        );
      }
    } catch (err) {
      console.error("Failed to build requirement docs zip:", err);
      alert("Failed to download documents. Please try again.");
    } finally {
      setZippingDocs(false);
    }
  }

  const filtered = useMemo(
    () =>
      regs.filter((r) => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          r.name?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q);
        const matchStatus = filterStatus === "all" || r.status === filterStatus;
        const matchPayment =
          filterPayment === "all" ||
          (filterPayment === "outstanding"
            ? r.status !== "cancelled" && r.paymentStatus !== "verified"
            : r.paymentStatus === filterPayment);
        let matchCompliance = true;
        if (filterCompliance !== "all") {
          const missing = missingCompliance(r, climb);
          matchCompliance =
            filterCompliance === "complete"
              ? missing.length === 0
              : filterCompliance === "incomplete"
                ? missing.length > 0
                : missing.includes(filterCompliance);
        }
        return matchSearch && matchStatus && matchPayment && matchCompliance;
      }),
    [regs, search, filterStatus, filterPayment, filterCompliance, climb],
  );

  const getOutstanding = useCallback(
    (reg) => getOutstandingShared(reg, climb),
    [climb],
  );

  const stats = useMemo(
    () => ({
      total: regs.length,
      confirmed: regs.filter((r) => r.status === "confirmed").length,
      pending: regs.filter((r) => r.status === "pending").length,
      waitlisted: regs.filter((r) => r.status === "waitlisted").length,
      cancelled: regs.filter((r) => r.status === "cancelled").length,
      awaitingPayment: regs.filter((r) => r.paymentStatus === "submitted")
        .length,
      totalPaid: regs
        .filter((r) => r.paymentStatus === "verified")
        .reduce((s, r) => s + (Number(r.amountPaid) || 0), 0),
      totalMissing: regs
        .filter((r) => r.status !== "cancelled")
        .reduce((s, r) => s + getOutstanding(r), 0),
    }),
    [regs, getOutstanding],
  );

  const docs = useMemo(() => getDocCompliance(climb, regs), [climb, regs]);

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">
        {/* Image lightbox */}
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
              alt="Proof of payment"
              style={{
                maxWidth: "92vw",
                maxHeight: "90vh",
                borderRadius: 8,
                boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
              }}
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
          <Link to="/admin/climbs">Climbs</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>{climb?.title || "…"}</span>
        </div>

        <div className="admin-page-header">
          <div>
            <div className="admin-page-title">{climb?.title || "…"}</div>
            <div className="admin-page-subtitle">
              {climb?.dateLabel} &bull; {climb?.location}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/admin" className="btn btn-outline btn-sm">
              &larr; Back to Admin
            </Link>
            <Link
              to={`/event/${id}`}
              className="btn btn-outline btn-sm"
              target="_blank"
              title="Open the public event page in a new tab"
            >
              View Page
            </Link>
            <button
              className="btn btn-outline btn-sm"
              onClick={exportCSV}
              title="Download all registrations for this climb as a CSV file"
            >
              &#128229; Export CSV
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={downloadAllDocs}
              disabled={zippingDocs}
              title="Download every uploaded requirement document for this climb — registration forms, medical certificates, permits and waivers — as a ZIP file, one folder per registrant"
            >
              {zippingDocs ? "Zipping…" : "📁 Download Docs (ZIP)"}
            </button>
            <button
              className="btn btn-gold btn-sm"
              onClick={() => setAddJoinerOpen(true)}
              title="Manually add a participant who wasn't registered through the app — e.g. a walk-in joiner on a completed climb"
            >
              + Add Participant
            </button>
            <Link
              to={`/admin/climbs/${id}/edit`}
              className="btn btn-accent btn-sm"
              title="Edit climb details, officers, itinerary, and settings"
            >
              Edit Climb
            </Link>
          </div>
        </div>

        {addJoinerOpen && (
          <AddJoinerModal
            climb={climb}
            climbId={id}
            onClose={() => setAddJoinerOpen(false)}
            onAdded={() => setAddJoinerOpen(false)}
          />
        )}

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Stats */}
            <div className="admin-stats">
              <div className="admin-stat-card">
                <div className="admin-stat-num">{stats.total}</div>
                <div className="admin-stat-label">Total</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-num">{stats.confirmed}</div>
                <div className="admin-stat-label">Confirmed</div>
              </div>
              <div className="admin-stat-card gold">
                <div className="admin-stat-num">{stats.pending}</div>
                <div className="admin-stat-label">Pending</div>
              </div>
              <div className="admin-stat-card accent">
                <div className="admin-stat-num">{stats.waitlisted}</div>
                <div className="admin-stat-label">Waitlisted</div>
              </div>
              <div className="admin-stat-card danger">
                <div className="admin-stat-num">{stats.cancelled}</div>
                <div className="admin-stat-label">Cancelled</div>
              </div>
              <div className="admin-stat-card gold">
                <div className="admin-stat-num">{stats.awaitingPayment}</div>
                <div className="admin-stat-label">Awaiting Payment Review</div>
              </div>
              <div className="admin-stat-card accent">
                <div className="admin-stat-num">
                  ₱{stats.totalPaid.toLocaleString("en-PH")}
                </div>
                <div className="admin-stat-label">Total Paid</div>
              </div>
              <div className="admin-stat-card danger">
                <div className="admin-stat-num">
                  ₱{stats.totalMissing.toLocaleString("en-PH")}
                </div>
                <div className="admin-stat-label">Total Outstanding</div>
              </div>
              {climb?.maxParticipants && (
                <div className="admin-stat-card">
                  <div className="admin-stat-num">
                    {climb.maxParticipants - stats.confirmed}
                  </div>
                  <div className="admin-stat-label">Open Slots</div>
                </div>
              )}
              {docs.expected > 0 && (
                <div
                  className={`admin-stat-card ${docs.complete ? "" : "gold"}`}
                  title={`${docs.submitted} of ${docs.expected} expected requirement documents have been submitted across ${docs.types.length} required document type${docs.types.length === 1 ? "" : "s"}. Cancelled registrants are excluded.`}
                >
                  <div className="admin-stat-num">
                    {docs.submitted}
                    <span style={{ fontSize: "1.2rem", opacity: 0.55 }}>
                      /{docs.expected}
                    </span>
                  </div>
                  <div className="admin-stat-label">Required Docs In</div>
                </div>
              )}
            </div>

            <CollectionBreakdown
              regs={regs}
              climb={climb}
              totalPaid={stats.totalPaid}
            />

            {/* Required documents progress — how much of the paperwork this
                climb asked for has actually come in, per document type, so an
                officer can see which requirement is lagging without reading
                down the compliance column of every row. */}
            {docs.expected > 0 && (
              <div className="admin-card" style={{ marginBottom: 28 }}>
                <div className="admin-card-title">
                  Required Documents — {docs.submitted}/{docs.expected}{" "}
                  submitted
                </div>
                <p
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--ink-soft)",
                    margin: "0 0 16px",
                  }}
                >
                  {docs.complete ? (
                    <>&#10003; Every expected document is in.</>
                  ) : (
                    <>
                      {docs.missing} document{docs.missing === 1 ? "" : "s"}{" "}
                      still outstanding from {docs.registrantsMissing}{" "}
                      participant
                      {docs.registrantsMissing === 1 ? "" : "s"}. Cancelled
                      registrants are not counted.
                    </>
                  )}
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: 16,
                  }}
                >
                  {docs.types.map((t) => {
                    const pct = t.expected
                      ? Math.round((t.submitted / t.expected) * 100)
                      : 0;
                    return (
                      <div key={t.key}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            gap: 8,
                            fontSize: "0.8rem",
                            fontWeight: 700,
                          }}
                        >
                          <span>
                            {t.pillIcon} {t.badgeLabel}
                          </span>
                          <span
                            style={{
                              color: t.missing
                                ? "#b45309"
                                : "var(--green-dark)",
                            }}
                          >
                            {t.submitted}/{t.expected}
                          </span>
                        </div>
                        <span className="slot-bar">
                          <span
                            className={`slot-bar-fill ${t.missing ? "low" : "ok"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <div
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--ink-soft)",
                            marginTop: 4,
                          }}
                        >
                          {t.missing
                            ? `${t.missing} missing`
                            : "All submitted"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Officers */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                  }}
                >
                  Climb Officers
                </div>
                {(!climb?.officers || climb.officers.length === 0) && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      background: "#fce8e8",
                      color: "#b91c1c",
                      border: "1px solid #fca5a5",
                    }}
                  >
                    &#9888; No officers assigned
                  </span>
                )}
                <Link
                  to={`/admin/climbs/${id}/edit`}
                  title="Go to the edit page to add or update officers"
                  style={{
                    marginLeft: "auto",
                    fontSize: "0.78rem",
                    color: "var(--ink-soft)",
                    textDecoration: "none",
                  }}
                >
                  + Manage Officers
                </Link>
              </div>

              {climb?.officers?.length > 0 ? (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {climb.officers.map((o, i) => (
                    <div
                      key={i}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: "10px 16px",
                        minWidth: 180,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                        {o.name || "—"}
                      </div>
                      {o.role && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--ink-soft)",
                            marginTop: 2,
                          }}
                        >
                          {o.role}
                        </div>
                      )}
                      {o.contact && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--ink-soft)",
                            marginTop: 2,
                          }}
                        >
                          {o.contact}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: "14px 18px",
                    borderRadius: 8,
                    background: "#fce8e8",
                    border: "1px solid #fca5a5",
                    fontSize: "0.85rem",
                    color: "#b91c1c",
                  }}
                >
                  This climb has no officers assigned yet. Please{" "}
                  <Link
                    to={`/admin/climbs/${id}/edit`}
                    style={{ color: "#b91c1c", fontWeight: 700 }}
                  >
                    edit the climb
                  </Link>{" "}
                  to add officers.
                </div>
              )}
            </div>

            {/* Filters */}
            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <input
                type="search"
                className="form-input"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: "1 1 200px", maxWidth: 280 }}
              />
              <select
                className="form-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ width: "auto" }}
              >
                <option value="all">All Status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="form-select"
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
                style={{ width: "auto" }}
              >
                <option value="all">All Payments</option>
                <option value="outstanding">Has Outstanding Balance</option>
                <option value="unpaid">Unpaid</option>
                <option value="submitted">Payment Submitted</option>
                <option value="verified">Payment Verified</option>
                <option value="rejected">Payment Rejected</option>
              </select>
              <select
                className="form-select"
                value={filterCompliance}
                onChange={(e) => setFilterCompliance(e.target.value)}
                style={{ width: "auto" }}
                title="Narrow the list to who still owes a waiver, their details, or one of this climb's required documents"
              >
                <option value="all">All Compliance</option>
                <option value="complete">Fully Compliant</option>
                <option value="incomplete">Missing Anything</option>
                <option value="waiver">Missing Waiver</option>
                <option value="details">Missing Details</option>
                {REQUIRED_DOC_TYPES.filter(
                  (docType) => climb?.[docType.requiresField],
                ).map((docType) => (
                  <option key={docType.key} value={`doc:${docType.key}`}>
                    Missing {docType.badgeLabel}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--ink-soft)",
                marginBottom: 8,
              }}
            >
              Showing {filtered.length} of {regs.length}
            </div>

            {/* Table */}
            <ResponsiveTable>
              <table className="admin-table table-min-980">
                <thead>
                  <tr>
                    <th style={{ minWidth: 40 }}>#</th>
                    <th>Participant</th>
                    <th style={{ minWidth: 130, whiteSpace: "nowrap" }}>
                      Compliance
                    </th>
                    <th style={{ minWidth: 110, whiteSpace: "nowrap" }}>
                      Payment
                    </th>
                    <th style={{ minWidth: 90, whiteSpace: "nowrap" }}>
                      Balance
                    </th>
                    <th style={{ minWidth: 110, whiteSpace: "nowrap" }}>
                      Status
                    </th>
                    <th style={{ minWidth: 150, whiteSpace: "nowrap" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: "center",
                          color: "var(--ink-soft)",
                          padding: "32px 0",
                        }}
                      >
                        No registrations found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((reg, idx) => (
                      <RegistrantRow
                        key={reg.id}
                        reg={reg}
                        idx={idx}
                        climb={climb}
                        expandedId={expandedId}
                        toggleExpand={toggleExpand}
                        changeStatus={changeStatus}
                        changePaymentStatus={changePaymentStatus}
                        onEntryStatusChange={changeEntryStatus}
                        onRecordPayment={setRecordingPaymentFor}
                        onViewReceipt={setViewingReceiptFor}
                        onManageDocuments={setManagingDocsFor}
                        toggleOptionalFee={toggleOptionalFee}
                        onEdit={setEditingReg}
                        deleteRegistration={deleteRegistration}
                        editNotes={editNotes}
                        setEditNotes={setEditNotes}
                        startNoteEdit={startNoteEdit}
                        saveNote={saveNote}
                        savingNote={savingNote}
                        setLightboxUrl={setLightboxUrl}
                        getOutstanding={getOutstanding}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </ResponsiveTable>
          </>
        )}

        {feedback.length > 0 && (
          <div className="admin-card" style={{ marginTop: 24 }}>
            <div className="admin-card-title">
              Climb Feedback ({feedback.length})
            </div>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--ink-soft)",
                marginBottom: 16,
              }}
            >
              Average rating:{" "}
              <strong>
                {(
                  feedback.reduce((sum, f) => sum + (f.rating || 0), 0) /
                  feedback.length
                ).toFixed(1)}
                /5
              </strong>
            </p>
            <table className="admin-table">
              <tbody>
                {feedback
                  .slice()
                  .sort(
                    (a, b) =>
                      (b.createdAt?.toDate?.()?.getTime() || 0) -
                      (a.createdAt?.toDate?.()?.getTime() || 0),
                  )
                  .map((f) => (
                    <tr key={f.id}>
                      <td style={{ width: "1%" }}>
                        {f.name || "Anonymous"}
                      </td>
                      <td
                        style={{
                          width: "1%",
                          whiteSpace: "nowrap",
                          color: "var(--gold)",
                        }}
                      >
                        {"★".repeat(f.rating || 0)}
                        {"☆".repeat(5 - (f.rating || 0))}
                      </td>
                      <td style={{ fontSize: "0.85rem" }}>
                        {f.comments || (
                          <span style={{ color: "var(--ink-soft)" }}>
                            No comments
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {recordingPaymentFor && (
        <RecordPaymentModal
          reg={recordingPaymentFor}
          onClose={() => setRecordingPaymentFor(null)}
          onSave={recordPayment}
        />
      )}

      {viewingReceiptFor && (
        <ReceiptModal
          reg={viewingReceiptFor}
          climb={climb}
          onClose={() => setViewingReceiptFor(null)}
          emptyLogText="No payment recorded yet for this participant."
        />
      )}

      {managingDocsFor && (
        <AdminDocumentModal
          reg={managingDocsFor}
          climb={climb}
          currentUser={currentUser}
          onClose={() => setManagingDocsFor(null)}
          onSave={saveAdminDocs}
        />
      )}

      {editingReg && (
        <EditRegistrationModal
          reg={editingReg}
          climb={climb}
          onClose={() => setEditingReg(null)}
          onSave={saveRegistrationEdit}
        />
      )}

      <Footer />
    </div>
  );
}
