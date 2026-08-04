import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "@/firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logFailedRequest } from "@/utils/logFailedRequest";
import { logAuditEvent } from "@/utils/auditLog";

const OFFICER_ROLES = [
  "Senior Team Leader",
  "Team Leader",
  "Assistant Team Leader",
  "Scribe",
];

const COLOR_OPTIONS = [
  { value: "c-slate", label: "Slate (grey-blue)" },
  { value: "c-crimson", label: "Crimson (red)" },
  { value: "c-purple", label: "Purple" },
  { value: "c-teal", label: "Teal" },
  { value: "c-ember", label: "Ember (orange)" },
  { value: "c-forest", label: "Forest (green)" },
  { value: "c-olive", label: "Olive" },
  { value: "c-navy", label: "Navy (blue)" },
  { value: "c-gold", label: "Gold" },
  { value: "c-magenta", label: "Magenta (pink)" },
  { value: "c-indigo", label: "Indigo" },
  { value: "c-deep-teal", label: "Deep Teal" },
];
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const DEFAULT_THINGS_TO_BRING = [
  "Day pack / Overnight pack",
  "Water, 2–3 litres per day",
  "Snacks / Trail food",
  "Packed meals",
  "Mess kit",
  "Sunscreen / Umbrella",
  "Jacket (preferably rainproof)",
  "Rain gear",
  "Emergency blanket",
  "Individual first aid kit",
  "Personal toiletries",
  "Head lamp",
  "Camera / Mobile phone",
  "Plastic bag / Trash bag",
];

const EMPTY_FORM = {
  title: "",
  dateLabel: "",
  month: "jul",
  startDate: "",
  endDate: "",
  location: "",
  type: "minor",
  color: "c-slate",
  status: "draft",
  maxParticipants: 30,
  isWide: false,
  itineraryReady: false,
  description: "",
  // Mountain profile
  elevation: "",
  difficulty: "",
  trailClass: "",
  jumpOff: "",
  jumpOffElevation: "",
  elevationGain: "",
  distanceToSummit: "",
  roundTripDistance: "",
  recommendedDays: "",
  features: "",
  googleMapsUrl: "",
  allTrailsUrl: "",
  trailImages: [],
  waterSourceNote: "",
  weatherNote: "",
  thingsToBring: [...DEFAULT_THINGS_TO_BRING],
  fees: [
    { label: "Registration Fee", amount: "TBA", note: "", optional: false },
    { label: "Guide Fee", amount: "TBA", note: "", optional: false },
    { label: "Environmental Fee", amount: "TBA", note: "", optional: false },
    {
      label: "Guest Fee",
      amount: "450",
      note: "Required for non-members / guests. Not charged to MMS members.",
      optional: true,
      isGuestFee: true,
    },
    {
      label: "Transportation Fee",
      amount: "TBA",
      note: "Only if availing organized transport",
      optional: true,
    },
    {
      label: "Food & Meals",
      amount: "TBA",
      note: "Only if availing organized meals",
      optional: true,
    },
  ],
  officers: [],
  officerEmails: [],
  itinerary: [],
  announcements: [],
  preClimbMeetings: [],
  resources: [],
  trailMaps: [],
  gcashName: "",
  gcashNumber: "",
  gcashQrUrl: "",
  requiresRegistrationForm: false,
  registrationFormUrl: "",
  registrationFormFileName: "",
  requiresMedicalCert: false,
  medicalCertSampleUrl: "",
  medicalCertSampleFileName: "",
};

export default function AdminClimbForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [gcashUploading, setGcashUploading] = useState(false);
  const [docUploading, setDocUploading] = useState({});
  const [trailImgUploading, setTrailImgUploading] = useState(false);
  const [trailUrlInput, setTrailUrlInput] = useState("");

  useEffect(() => {
    getDocs(query(collection(db, "users"), orderBy("displayName")))
      .then((snap) => {
        setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    Promise.all([
      getDoc(doc(db, "climbs", id)),
      getDoc(doc(db, "climbPrivate", id)),
    ]).then(([snap, privateSnap]) => {
      if (snap.exists()) {
        const data = snap.data();
        // Migrate the legacy single googleMapsUrl/allTrailsUrl fields into
        // the new repeatable trailMaps list so existing data isn't lost.
        const trailMaps =
          data.trailMaps?.length > 0
            ? data.trailMaps
            : data.googleMapsUrl || data.allTrailsUrl
              ? [
                  {
                    label: "",
                    googleMapsUrl: data.googleMapsUrl || "",
                    allTrailsUrl: data.allTrailsUrl || "",
                  },
                ]
              : [];
        const priv = privateSnap.exists() ? privateSnap.data() : {};
        // Pre-climb meeting used to be a single object (climbPrivate, then
        // briefly the climb doc itself before that) — migrate either legacy
        // shape into the new repeatable list so nothing already saved is
        // lost; the next save writes it back out in the new shape only.
        const preClimbMeetings =
          priv.preClimbMeetings?.length > 0
            ? priv.preClimbMeetings
            : priv.preClimbMeetingDate || data.preClimbMeetingDate
              ? [
                  {
                    date: priv.preClimbMeetingDate ?? data.preClimbMeetingDate ?? "",
                    time: priv.preClimbMeetingTime ?? data.preClimbMeetingTime ?? "",
                    location: priv.preClimbMeetingLocation ?? data.preClimbMeetingLocation ?? "",
                    link: priv.preClimbMeetingLink ?? "",
                    recordingLink: priv.preClimbMeetingRecordingLink ?? "",
                    notes: priv.preClimbMeetingNotes ?? data.preClimbMeetingNotes ?? "",
                  },
                ]
              : [];
        setForm({
          ...EMPTY_FORM,
          ...data,
          trailMaps,
          preClimbMeetings,
          resources: priv.resources ?? [],
        });
      }
      setLoading(false);
    });
  }, [id, isEdit]);

  function set(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  // Dynamic list helpers
  function addListItem(field, item) {
    setForm((p) => ({ ...p, [field]: [...(p[field] || []), item] }));
  }
  function removeListItem(field, i) {
    setForm((p) => ({ ...p, [field]: p[field].filter((_, idx) => idx !== i) }));
  }
  function updateListItem(field, i, val) {
    setForm((p) => {
      const arr = [...p[field]];
      arr[i] = val;
      return { ...p, [field]: arr };
    });
  }

  // Itinerary helpers
  function addDay() {
    addListItem("itinerary", { day: "", entries: [] });
  }

  async function handleTrailImageUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setTrailImgUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const sRef = ref(
          storage,
          `trail-images/${id || "new"}/${Date.now()}_${file.name}`,
        );
        await uploadBytes(sRef, file);
        const url = await getDownloadURL(sRef);
        uploaded.push(url);
      }
      set("trailImages", [...(form.trailImages || []), ...uploaded]);
    } catch (err) {
      setError("Failed to upload trail image: " + err.message);
      logFailedRequest({
        type: "upload",
        source: "ClimbForm.jsx:trailImageUpload",
        message: err?.message,
        path: window.location.pathname,
        userId: currentUser?.uid,
        userRole: "admin",
        climbId: id,
      });
    } finally {
      setTrailImgUploading(false);
      e.target.value = "";
    }
  }

  async function handleGcashQrUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setGcashUploading(true);
    try {
      const storageRef = ref(
        storage,
        `gcash-qr/${id || "new"}/${Date.now()}_${file.name}`,
      );
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      set("gcashQrUrl", url);
    } catch (err) {
      setError("Failed to upload GCash QR image: " + err.message);
      logFailedRequest({
        type: "upload",
        source: "ClimbForm.jsx:gcashQrUpload",
        message: err?.message,
        path: window.location.pathname,
        userId: currentUser?.uid,
        userRole: "admin",
        climbId: id,
      });
    } finally {
      setGcashUploading(false);
    }
  }
  async function handleDocUpload(e, urlField, fileNameField, storagePrefix) {
    const file = e.target.files[0];
    if (!file) return;
    setDocUploading((p) => ({ ...p, [urlField]: true }));
    try {
      const sRef = ref(
        storage,
        `${storagePrefix}/${id || "new"}/${Date.now()}_${file.name}`,
      );
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      setForm((p) => ({ ...p, [urlField]: url, [fileNameField]: file.name }));
    } catch (err) {
      setError("Failed to upload file: " + err.message);
      logFailedRequest({
        type: "upload",
        source: "ClimbForm.jsx:docUpload",
        message: err?.message,
        path: window.location.pathname,
        userId: currentUser?.uid,
        userRole: "admin",
        climbId: id,
      });
    } finally {
      setDocUploading((p) => ({ ...p, [urlField]: false }));
      e.target.value = "";
    }
  }
  function removeDay(i) {
    removeListItem("itinerary", i);
  }
  function updateDay(i, val) {
    updateListItem("itinerary", i, { ...form.itinerary[i], day: val });
  }
  function addEntry(dayIdx) {
    setForm((p) => {
      const itinerary = p.itinerary.map((d, i) =>
        i === dayIdx
          ? { ...d, entries: [...d.entries, { time: "", activity: "" }] }
          : d,
      );
      return { ...p, itinerary };
    });
  }
  function removeEntry(dayIdx, entryIdx) {
    setForm((p) => {
      const itinerary = p.itinerary.map((d, i) =>
        i === dayIdx
          ? { ...d, entries: d.entries.filter((_, j) => j !== entryIdx) }
          : d,
      );
      return { ...p, itinerary };
    });
  }
  function updateEntry(dayIdx, entryIdx, field, val) {
    setForm((p) => {
      const itinerary = p.itinerary.map((d, i) => {
        if (i !== dayIdx) return d;
        const entries = d.entries.map((e, j) =>
          j === entryIdx ? { ...e, [field]: val } : e,
        );
        return { ...d, entries };
      });
      return { ...p, itinerary };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Validate officer emails
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const badOfficer = (form.officers || []).find(
      (o) => o.email && !emailRe.test(o.email),
    );
    if (badOfficer) {
      setError(
        `Invalid email address for officer "${badOfficer.name || "unnamed"}": ${badOfficer.email}`,
      );
      return;
    }

    setSaving(true);
    try {
      const { preClimbMeetings, resources, ...publicForm } = form;
      // Pre-climb meeting details and resource links are genuinely
      // registrants-only (see climbPrivate rule in firestore.rules) — they
      // must never land on the publicly-readable climbs document.
      const privateData = {
        preClimbMeetings: preClimbMeetings || [],
        resources: resources || [],
        // Clear the legacy single-meeting shape so it doesn't linger
        // alongside the new list on climbs edited before this changed.
        preClimbMeetingDate: null,
        preClimbMeetingTime: null,
        preClimbMeetingLocation: null,
        preClimbMeetingNotes: null,
        preClimbMeetingLink: null,
        preClimbMeetingRecordingLink: null,
      };

      const payload = {
        ...publicForm,
        maxParticipants: Number(form.maxParticipants),
        updatedAt: serverTimestamp(),
      };
      payload.officerIds = (form.officers || [])
        .map((o) => o.userId)
        .filter(Boolean);
      // Keep the legacy single googleMapsUrl/allTrailsUrl fields in sync
      // with the first trail so older code paths (e.g. the weather forecast
      // location lookup) still resolve correctly.
      payload.googleMapsUrl = form.trailMaps?.[0]?.googleMapsUrl || "";
      payload.allTrailsUrl = form.trailMaps?.[0]?.allTrailsUrl || "";
      // Clear any legacy copy left over from before these fields moved to
      // climbPrivate, so the data isn't duplicated on the public doc.
      payload.preClimbMeetingDate = null;
      payload.preClimbMeetingTime = null;
      payload.preClimbMeetingLocation = null;
      payload.preClimbMeetingNotes = null;
      if (isEdit) {
        await updateDoc(doc(db, "climbs", id), payload);
        await setDoc(doc(db, "climbPrivate", id), privateData, { merge: true });
        logAuditEvent({
          actorUid: currentUser?.uid,
          actorName: currentUser?.displayName || currentUser?.email,
          action: "climb_updated",
          targetType: "climb",
          targetId: id,
          targetLabel: form.title,
        });
      } else {
        payload.createdAt = serverTimestamp();
        payload.createdBy = currentUser.uid;
        payload.registrationCount = 0;
        const ref = await addDoc(collection(db, "climbs"), payload);
        await setDoc(doc(db, "climbPrivate", ref.id), privateData, { merge: true });
        logAuditEvent({
          actorUid: currentUser?.uid,
          actorName: currentUser?.displayName || currentUser?.email,
          action: "climb_created",
          targetType: "climb",
          targetId: ref.id,
          targetLabel: form.title,
        });
      }
      navigate("/admin/climbs");
    } catch (err) {
      setError("Save failed: " + err.message);
      logFailedRequest({
        type: "firestore",
        source: "ClimbForm.jsx:save",
        message: err?.message,
        path: window.location.pathname,
        userId: currentUser?.uid,
        userRole: "admin",
        climbId: id,
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">
        <div className="admin-breadcrumb">
          <Link to="/admin">Dashboard</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <Link to="/admin/climbs">Climbs</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>{isEdit ? "Edit" : "New Climb"}</span>
        </div>
        <div className="admin-page-header">
          <div className="admin-page-title">
            {isEdit ? "Edit Climb" : "New Climb"}
          </div>
          <Link to="/admin" className="btn btn-outline btn-sm">
            &larr; Back to Admin
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* ── Basic Info ── */}
          <div className="admin-card">
            <div className="admin-card-title">Basic Information</div>
            <div className="form-group">
              <label className="form-label required">Climb Title</label>
              <input
                type="text"
                className="form-input"
                required
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">
                  Date Label{" "}
                  <span
                    style={{
                      fontWeight: 400,
                      textTransform: "none",
                      letterSpacing: 0,
                    }}
                  >
                    (display text)
                  </span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Jul 04–05"
                  value={form.dateLabel}
                  onChange={(e) => set("dateLabel", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label required">Month</label>
                <select
                  className="form-select"
                  required
                  value={form.month}
                  onChange={(e) => set("month", e.target.value)}
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Start Date</label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.endDate}
                  onChange={(e) => set("endDate", e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label required">Location</label>
              <input
                type="text"
                className="form-input"
                required
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Type</label>
                <select
                  className="form-select"
                  required
                  value={form.type}
                  onChange={(e) => set("type", e.target.value)}
                >
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                  <option value="special">Special</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required">Card Colour</label>
                <select
                  className="form-select"
                  required
                  value={form.color}
                  onChange={(e) => set("color", e.target.value)}
                >
                  {COLOR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Max Participants</label>
                <input
                  type="number"
                  className="form-input"
                  required
                  min={1}
                  value={form.maxParticipants}
                  onChange={(e) => set("maxParticipants", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label required">Status</label>
                <select
                  className="form-select"
                  required
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  <option value="draft">Draft</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.isWide}
                  onChange={(e) => set("isWide", e.target.checked)}
                />
                Wide card (spans 2 columns in grid)
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.itineraryReady}
                  onChange={(e) => set("itineraryReady", e.target.checked)}
                />
                Mark itinerary as ready
              </label>
            </div>
          </div>

          {/* ── Mountain Profile ── */}
          <div className="admin-card">
            <div className="admin-card-title">Mountain Profile</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Elevation (MASL)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 678"
                  value={form.elevation}
                  onChange={(e) => set("elevation", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Difficulty</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 3/9"
                  value={form.difficulty}
                  onChange={(e) => set("difficulty", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Trail Class</label>
                <select
                  className="form-select"
                  value={form.trailClass}
                  onChange={(e) => set("trailClass", e.target.value)}
                >
                  <option value="">— Not specified —</option>
                  <option value="1">Class 1 — Easy day hike</option>
                  <option value="2">Class 2 — Moderate day hike</option>
                  <option value="3">Class 3 — Strenuous day hike</option>
                  <option value="4">Class 4 — Minor climb</option>
                  <option value="5">Class 5 — Major climb</option>
                  <option value="6">Class 6 — Technical climb</option>
                  <option value="7">Class 7 — Very technical</option>
                  <option value="8">Class 8 — Extreme</option>
                  <option value="9">Class 9 — Super extreme</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Jump-off Point</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Brgy. Omaya"
                  value={form.jumpOff}
                  onChange={(e) => set("jumpOff", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Jump-off Elevation (m)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 180"
                  value={form.jumpOffElevation}
                  onChange={(e) => set("jumpOffElevation", e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Elevation Gain</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. +498m"
                  value={form.elevationGain}
                  onChange={(e) => set("elevationGain", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Recommended Days</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 2 Days"
                  value={form.recommendedDays}
                  onChange={(e) => set("recommendedDays", e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Distance to Summit</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ~4.5 km"
                  value={form.distanceToSummit}
                  onChange={(e) => set("distanceToSummit", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Round Trip Distance</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ~9 km"
                  value={form.roundTripDistance}
                  onChange={(e) => set("roundTripDistance", e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notable Features</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Ridge trails, river crossings, panoramic views, Veto Falls"
                value={form.features}
                onChange={(e) => set("features", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description / Background</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Brief background about the mountain…"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 16,
                marginBottom: 12,
              }}
            >
              <div
                className="admin-card-title"
                style={{ fontSize: "0.75rem", marginBottom: 0 }}
              >
                Map &amp; Trail Data
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() =>
                  addListItem("trailMaps", {
                    label: "",
                    googleMapsUrl: "",
                    allTrailsUrl: "",
                  })
                }
              >
                + Add Trail
              </button>
            </div>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--ink-soft)",
                marginBottom: 12,
              }}
            >
              Add more than one trail if there's more than one route being
              considered — registrants will see a tab to switch between them
              on the event page.
            </p>
            {(form.trailMaps || []).length === 0 && (
              <div className="form-hint" style={{ marginBottom: 12 }}>
                No trail added yet. Click "+ Add Trail" to add a Google Maps
                and/or AllTrails link.
              </div>
            )}
            {(form.trailMaps || []).map((trail, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    className="form-input"
                    placeholder={`Trail label (e.g. "Trail A — Ambangeg")`}
                    value={trail.label}
                    onChange={(e) =>
                      updateListItem("trailMaps", i, {
                        ...trail,
                        label: e.target.value,
                      })
                    }
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeListItem("trailMaps", i)}
                  >
                    ✕
                  </button>
                </div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Google Maps URL</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://www.google.com/maps/@15.717,119.935,14z"
                    value={trail.googleMapsUrl}
                    onChange={(e) =>
                      updateListItem("trailMaps", i, {
                        ...trail,
                        googleMapsUrl: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">AllTrails Trail URL</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://www.alltrails.com/trail/philippines/..."
                    value={trail.allTrailsUrl}
                    onChange={(e) =>
                      updateListItem("trailMaps", i, {
                        ...trail,
                        allTrailsUrl: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            ))}
            <div className="form-group">
              <label className="form-label">Trail Photos</label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                {(form.trailImages || []).map((url, i) => (
                  <div
                    key={i}
                    style={{ position: "relative", display: "inline-block" }}
                  >
                    <img
                      src={url}
                      alt={`Trail ${i + 1}`}
                      style={{
                        width: 100,
                        height: 80,
                        objectFit: "cover",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        display: "block",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "trailImages",
                          form.trailImages.filter((_, idx) => idx !== i),
                        )
                      }
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 99,
                        width: 20,
                        height: 20,
                        cursor: "pointer",
                        fontSize: "0.7rem",
                        lineHeight: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title="Remove"
                    >
                      &#x2715;
                    </button>
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <label
                  className="btn btn-outline btn-sm"
                  style={{
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {trailImgUploading ? "Uploading…" : "↑ Upload Photos"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={handleTrailImageUpload}
                    disabled={trailImgUploading}
                  />
                </label>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 10,
                  alignItems: "center",
                }}
              >
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://example.com/photo.jpg"
                  value={trailUrlInput}
                  onChange={(e) => setTrailUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = trailUrlInput.trim();
                      if (v) {
                        set("trailImages", [...(form.trailImages || []), v]);
                        setTrailUrlInput("");
                      }
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    const v = trailUrlInput.trim();
                    if (v) {
                      set("trailImages", [...(form.trailImages || []), v]);
                      setTrailUrlInput("");
                    }
                  }}
                >
                  + Add URL
                </button>
              </div>
              <div className="form-hint" style={{ marginTop: 6 }}>
                Upload photos from your device or paste a direct image URL
                (press Enter or click + Add URL).
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Water Source Note</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Notes about water sources, potability, etc."
                value={form.waterSourceNote}
                onChange={(e) => set("waterSourceNote", e.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Weather Note</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Climate info, season notes, forecast warnings…"
                value={form.weatherNote}
                onChange={(e) => set("weatherNote", e.target.value)}
                style={{ resize: "vertical" }}
              />
            </div>
          </div>

          {/* ── Pre-Climb Meetings ── */}
          <div className="admin-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div className="admin-card-title" style={{ marginBottom: 0 }}>
                Pre-Climb Meetings
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() =>
                  addListItem("preClimbMeetings", {
                    date: "",
                    time: "",
                    location: "",
                    link: "",
                    recordingLink: "",
                    notes: "",
                  })
                }
              >
                + Add Meeting
              </button>
            </div>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--ink-soft)",
                marginBottom: 16,
              }}
            >
              Optional briefings before the climb (gear check, orientation,
              final headcount) — add one entry per session. Only visible to
              registered participants and admins, never on the public climb
              page.
            </p>
            {(form.preClimbMeetings || []).map((meeting, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Meeting Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={meeting.date}
                      onChange={(e) =>
                        updateListItem("preClimbMeetings", i, {
                          ...meeting,
                          date: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Meeting Time</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 6:00 PM"
                      value={meeting.time}
                      onChange={(e) =>
                        updateListItem("preClimbMeetings", i, {
                          ...meeting,
                          time: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Meeting Location</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. MMS Clubhouse, Quezon City"
                    value={meeting.location}
                    onChange={(e) =>
                      updateListItem("preClimbMeetings", i, {
                        ...meeting,
                        location: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">MS Teams / Zoom Link</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://teams.microsoft.com/… or https://zoom.us/j/…"
                    value={meeting.link}
                    onChange={(e) =>
                      updateListItem("preClimbMeetings", i, {
                        ...meeting,
                        link: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Meeting Recording Link</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="YouTube (unlisted) or Google Drive link, once available"
                    value={meeting.recordingLink}
                    onChange={(e) =>
                      updateListItem("preClimbMeetings", i, {
                        ...meeting,
                        recordingLink: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Meeting Notes</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="What to bring or expect at the meeting"
                    value={meeting.notes}
                    onChange={(e) =>
                      updateListItem("preClimbMeetings", i, {
                        ...meeting,
                        notes: e.target.value,
                      })
                    }
                    style={{ resize: "vertical" }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeListItem("preClimbMeetings", i)}
                >
                  Remove
                </button>
              </div>
            ))}
            {(form.preClimbMeetings || []).length === 0 && (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                No pre-climb meetings scheduled yet.
              </p>
            )}
          </div>

          {/* ── Climb Resources ── */}
          <div className="admin-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div className="admin-card-title" style={{ marginBottom: 0 }}>
                Climb Resources
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() =>
                  addListItem("resources", { label: "", url: "" })
                }
              >
                + Add Resource
              </button>
            </div>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--ink-soft)",
                marginBottom: 16,
              }}
            >
              Links registered participants need to check — trackers,
              shared sheets, packing lists, etc. Only visible to registered
              participants and admins.
            </p>
            {(form.resources || []).map((res, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="text"
                  className="form-input"
                  placeholder="Label (e.g. Packing Tracker)"
                  value={res.label}
                  onChange={(e) =>
                    updateListItem("resources", i, { ...res, label: e.target.value })
                  }
                  style={{ flex: "1 1 200px" }}
                />
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://docs.google.com/spreadsheets/…"
                  value={res.url}
                  onChange={(e) =>
                    updateListItem("resources", i, { ...res, url: e.target.value })
                  }
                  style={{ flex: "2 1 260px" }}
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeListItem("resources", i)}
                >
                  Remove
                </button>
              </div>
            ))}
            {(form.resources || []).length === 0 && (
              <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                No resources added yet.
              </p>
            )}
          </div>

          {/* ── Announcements ── */}
          <div className="admin-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div className="admin-card-title" style={{ marginBottom: 0 }}>
                Announcements
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() =>
                  addListItem("announcements", {
                    message: "",
                    pinned: false,
                    createdAt: Date.now(),
                  })
                }
              >
                + Add Announcement
              </button>
            </div>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--ink-soft)",
                marginBottom: 16,
              }}
            >
              Shown on the climb's public page, right under Mountain Profile —
              use this for updates and reminders all joiners need to see
              (schedule changes, weather advisories, what to prepare, etc.).
              Supports <strong>**bold**</strong> and <em>*italic*</em>.
            </p>
            {(form.announcements || []).map((note, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 8,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Announcement text"
                  value={note.message}
                  onChange={(e) =>
                    updateListItem("announcements", i, {
                      ...note,
                      message: e.target.value,
                    })
                  }
                  style={{ flex: "1 1 260px", resize: "vertical" }}
                />
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: "0.8rem",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                  }}
                  title="Pin important reminders to the top, highlighted"
                >
                  <input
                    type="checkbox"
                    checked={!!note.pinned}
                    onChange={(e) =>
                      updateListItem("announcements", i, {
                        ...note,
                        pinned: e.target.checked,
                      })
                    }
                  />
                  Pin as reminder
                </label>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeListItem("announcements", i)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* ── Itinerary ── */}
          <div className="admin-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div className="admin-card-title" style={{ marginBottom: 0 }}>
                Itinerary
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={addDay}
              >
                + Add Day
              </button>
            </div>
            {form.itinerary.length === 0 && (
              <p className="tbd-note">
                No itinerary added yet. Click &ldquo;Add Day&rdquo; to start.
              </p>
            )}
            {form.itinerary.map((day, dayIdx) => (
              <div
                key={dayIdx}
                style={{
                  marginBottom: 20,
                  padding: 16,
                  background: "var(--surface)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 10,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Day label, e.g. Day 1 — Saturday, July 4"
                    value={day.day}
                    onChange={(e) => updateDay(dayIdx, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeDay(dayIdx)}
                  >
                    Remove Day
                  </button>
                </div>
                {day.entries.map((entry, entryIdx) => (
                  <div
                    key={entryIdx}
                    style={{ display: "flex", gap: 8, marginBottom: 6 }}
                  >
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Time e.g. 04:00"
                      value={entry.time}
                      onChange={(e) =>
                        updateEntry(dayIdx, entryIdx, "time", e.target.value)
                      }
                      style={{ width: 100, flexShrink: 0 }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Activity"
                      value={entry.activity}
                      onChange={(e) =>
                        updateEntry(
                          dayIdx,
                          entryIdx,
                          "activity",
                          e.target.value,
                        )
                      }
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeEntry(dayIdx, entryIdx)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => addEntry(dayIdx)}
                  style={{ marginTop: 4 }}
                >
                  + Add Entry
                </button>
              </div>
            ))}
          </div>

          {/* ── Things to Bring ── */}
          <div className="admin-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div className="admin-card-title" style={{ marginBottom: 0 }}>
                Things to Bring
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => addListItem("thingsToBring", "")}
              >
                + Add Item
              </button>
            </div>
            {form.thingsToBring.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Item"
                  value={item}
                  onChange={(e) =>
                    updateListItem("thingsToBring", i, e.target.value)
                  }
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeListItem("thingsToBring", i)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* ── Fees ── */}
          <div className="admin-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div className="admin-card-title" style={{ marginBottom: 0 }}>
                Fees
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() =>
                  addListItem("fees", {
                    label: "",
                    amount: "TBA",
                    note: "",
                    optional: false,
                  })
                }
              >
                + Add Fee
              </button>
            </div>
            {form.fees.map((fee, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="text"
                  className="form-input"
                  placeholder="Label"
                  value={fee.label}
                  onChange={(e) =>
                    updateListItem("fees", i, {
                      ...fee,
                      label: e.target.value,
                    })
                  }
                  style={{ flex: "2 1 160px" }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Amount"
                  value={fee.amount}
                  onChange={(e) =>
                    updateListItem("fees", i, {
                      ...fee,
                      amount: e.target.value,
                    })
                  }
                  style={{ flex: "1 1 80px" }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Note (optional)"
                  value={fee.note}
                  onChange={(e) =>
                    updateListItem("fees", i, {
                      ...fee,
                      note: e.target.value,
                    })
                  }
                  style={{ flex: "2 1 160px" }}
                />
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: "0.8rem",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                  }}
                  title="Optional fees let participants choose whether to include them"
                >
                  <input
                    type="checkbox"
                    checked={!!fee.optional}
                    onChange={(e) =>
                      updateListItem("fees", i, {
                        ...fee,
                        optional: e.target.checked,
                      })
                    }
                  />
                  Optional
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: "0.8rem",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                  }}
                  title="Charged only to non-member registrants; never charged to MMS members"
                >
                  <input
                    type="checkbox"
                    checked={!!fee.isGuestFee}
                    onChange={(e) =>
                      updateListItem("fees", i, {
                        ...fee,
                        isGuestFee: e.target.checked,
                      })
                    }
                  />
                  Guest Fee
                </label>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeListItem("fees", i)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* ── Officers ── */}
          <div className="admin-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div className="admin-card-title" style={{ marginBottom: 0 }}>
                Climb Officers
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() =>
                  addListItem("officers", {
                    name: "",
                    role: "",
                    contact: "",
                    email: "",
                  })
                }
              >
                + Add Officer
              </button>
            </div>
            {form.officers.length === 0 && (
              <p className="tbd-note">No officers assigned yet.</p>
            )}
            {form.officers.map((o, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 8,
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                <select
                  className="form-select"
                  value={o.userId || ""}
                  onChange={(e) => {
                    const uid = e.target.value;
                    if (!uid) {
                      updateListItem("officers", i, { ...o, userId: "" });
                      return;
                    }
                    const user = users.find((u) => u.uid === uid);
                    if (user) {
                      updateListItem("officers", i, {
                        ...o,
                        userId: uid,
                        name: user.displayName || o.name,
                        email: user.email || o.email,
                        contact: user.phone || user.contact || o.contact,
                      });
                    }
                  }}
                  style={{ flex: "2 1 180px" }}
                >
                  <option value="">— Link account (optional) —</option>
                  {users.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName || u.email}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Full Name"
                  value={o.name}
                  onChange={(e) =>
                    updateListItem("officers", i, {
                      ...o,
                      name: e.target.value,
                    })
                  }
                  style={{ flex: "2 1 160px" }}
                />
                <select
                  className="form-select"
                  value={
                    OFFICER_ROLES.includes(o.role)
                      ? o.role
                      : o.role
                        ? "Other"
                        : ""
                  }
                  onChange={(e) =>
                    updateListItem("officers", i, {
                      ...o,
                      role: e.target.value === "Other" ? "Other" : e.target.value,
                    })
                  }
                  style={{ flex: "2 1 160px" }}
                >
                  <option value="">— Select role —</option>
                  {OFFICER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value="Other">Other</option>
                </select>
                {!OFFICER_ROLES.includes(o.role) && o.role !== "" && (
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Custom role"
                    value={o.role === "Other" ? "" : o.role}
                    onChange={(e) =>
                      updateListItem("officers", i, {
                        ...o,
                        role: e.target.value,
                      })
                    }
                    style={{ flex: "2 1 140px" }}
                  />
                )}
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contact (phone/social)"
                  value={o.contact}
                  onChange={(e) =>
                    updateListItem("officers", i, {
                      ...o,
                      contact: e.target.value,
                    })
                  }
                  style={{ flex: "2 1 140px" }}
                />
                <input
                  type="email"
                  className={`form-input${o.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email) ? " input-error" : ""}`}
                  placeholder="Email address"
                  value={o.email || ""}
                  onChange={(e) =>
                    updateListItem("officers", i, {
                      ...o,
                      email: e.target.value.trim(),
                    })
                  }
                  style={{ flex: "2 1 160px" }}
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeListItem("officers", i)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* ── GCash Payment ── */}
          <div className="admin-card">
            <div className="admin-card-title">GCash Payment Details</div>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--ink-soft)",
                marginBottom: 16,
              }}
            >
              These details are shown to registrants on the registration form so
              they know where to send payment.
            </p>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">GCash Account Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Juan Dela Cruz"
                  value={form.gcashName}
                  onChange={(e) => set("gcashName", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">GCash Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 09XX XXX XXXX"
                  value={form.gcashNumber}
                  onChange={(e) => set("gcashNumber", e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">GCash QR Code Image</label>
              {form.gcashQrUrl && (
                <div style={{ marginBottom: 8 }}>
                  <img
                    src={form.gcashQrUrl}
                    alt="GCash QR"
                    style={{
                      width: 160,
                      height: 160,
                      objectFit: "contain",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      background: "#fff",
                    }}
                  />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="form-input"
                onChange={handleGcashQrUpload}
                disabled={gcashUploading}
              />
              {gcashUploading && (
                <div className="form-hint">Uploading QR code…</div>
              )}
              {form.gcashQrUrl && !gcashUploading && (
                <div
                  className="form-hint"
                  style={{ color: "var(--green-dark)" }}
                >
                  QR code uploaded.
                </div>
              )}
            </div>
          </div>

          {/* ── Required Documents ── */}
          <div className="admin-card">
            <div className="admin-card-title">Required Documents</div>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--ink-soft)",
                marginBottom: 16,
              }}
            >
              Optionally require participants to download a template or
              sample, then upload their own copy when they register.
            </p>

            <div className="form-group">
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.requiresRegistrationForm}
                  onChange={(e) =>
                    set("requiresRegistrationForm", e.target.checked)
                  }
                />
                Require a signed registration form upload
              </label>
            </div>
            {form.requiresRegistrationForm && (
              <div className="form-group">
                <label className="form-label">Registration Form Template</label>
                {form.registrationFormUrl && (
                  <div style={{ marginBottom: 8 }}>
                    <a
                      href={form.registrationFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                    >
                      &#128196; {form.registrationFormFileName || "View current template"}
                    </a>
                  </div>
                )}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  className="form-input"
                  onChange={(e) =>
                    handleDocUpload(
                      e,
                      "registrationFormUrl",
                      "registrationFormFileName",
                      "registration-form-templates",
                    )
                  }
                  disabled={docUploading.registrationFormUrl}
                />
                {docUploading.registrationFormUrl && (
                  <div className="form-hint">Uploading template…</div>
                )}
                {form.registrationFormUrl && !docUploading.registrationFormUrl && (
                  <div
                    className="form-hint"
                    style={{ color: "var(--green-dark)" }}
                  >
                    Template uploaded. Joiners will see a download link and a
                    required upload field when they register.
                  </div>
                )}
              </div>
            )}

            <div className="form-group" style={{ marginTop: 20 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.requiresMedicalCert}
                  onChange={(e) =>
                    set("requiresMedicalCert", e.target.checked)
                  }
                />
                Require a medical certificate upload
              </label>
            </div>
            {form.requiresMedicalCert && (
              <div className="form-group">
                <label className="form-label">
                  Sample Medical Certificate (for reference)
                </label>
                {form.medicalCertSampleUrl && (
                  <div style={{ marginBottom: 8 }}>
                    <a
                      href={form.medicalCertSampleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                    >
                      &#128196; {form.medicalCertSampleFileName || "View sample"}
                    </a>
                  </div>
                )}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  className="form-input"
                  onChange={(e) =>
                    handleDocUpload(
                      e,
                      "medicalCertSampleUrl",
                      "medicalCertSampleFileName",
                      "medical-cert-samples",
                    )
                  }
                  disabled={docUploading.medicalCertSampleUrl}
                />
                {docUploading.medicalCertSampleUrl && (
                  <div className="form-hint">Uploading sample…</div>
                )}
                {form.medicalCertSampleUrl && !docUploading.medicalCertSampleUrl && (
                  <div
                    className="form-hint"
                    style={{ color: "var(--green-dark)" }}
                  >
                    Sample uploaded. Joiners will see a reference link and a
                    required upload field when they register.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="btn btn-primary btn-lg"
              type="submit"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="spinner spinner-sm" /> Saving…
                </>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Create Climb"
              )}
            </button>
            <button
              className="btn btn-outline btn-lg"
              type="button"
              onClick={() => navigate("/admin/climbs")}
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}
