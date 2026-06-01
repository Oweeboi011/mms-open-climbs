import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  doc,
  getDoc,
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
  jumpOff: "",
  jumpOffElevation: "",
  elevationGain: "",
  distanceToSummit: "",
  roundTripDistance: "",
  recommendedDays: "",
  features: "",
  googleMapsUrl: "",
  allTrailsUrl: "",
  stravaUrl: "",
  corosUrl: "",
  waterSourceNote: "",
  weatherNote: "",
  thingsToBring: [...DEFAULT_THINGS_TO_BRING],
  expenses: [
    { label: "Registration Fee", amount: "TBA", note: "", optional: false },
    { label: "Guide Fee", amount: "TBA", note: "", optional: false },
    { label: "Environmental Fee", amount: "TBA", note: "", optional: false },
    { label: "Guest Fee", amount: "450", note: "Required for non-members / guests. Not charged to MMS members.", optional: true },
    { label: "Transportation Fee", amount: "TBA", note: "Only if availing organized transport", optional: true },
    { label: "Food & Meals", amount: "TBA", note: "Only if availing organized meals", optional: true },
  ],
  officers: [],
  itinerary: [],
  gcashName: "",
  gcashNumber: "",
  gcashQrUrl: "",
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

  useEffect(() => {
    getDocs(query(collection(db, "users"), orderBy("displayName")))
      .then((snap) => {
        setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    getDoc(doc(db, "climbs", id)).then((snap) => {
      if (snap.exists()) setForm({ ...EMPTY_FORM, ...snap.data() });
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

  async function handleGcashQrUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setGcashUploading(true);
    try {
      const storageRef = ref(storage, `gcash-qr/${id || "new"}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      set("gcashQrUrl", url);
    } catch (err) {
      setError("Failed to upload GCash QR image: " + err.message);
    } finally {
      setGcashUploading(false);
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
    setSaving(true);
    try {
      const payload = {
        ...form,
        maxParticipants: Number(form.maxParticipants),
        updatedAt: serverTimestamp(),
      };
      payload.officerIds = (form.officers || [])
        .map((o) => o.userId)
        .filter(Boolean);
      if (isEdit) {
        await updateDoc(doc(db, "climbs", id), payload);
      } else {
        payload.createdAt = serverTimestamp();
        payload.createdBy = currentUser.uid;
        payload.registrationCount = 0;
        await addDoc(collection(db, "climbs"), payload);
      }
      navigate("/admin/climbs");
    } catch (err) {
      setError("Save failed: " + err.message);
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
              className="admin-card-title"
              style={{ fontSize: "0.75rem", marginTop: 16, marginBottom: 12 }}
            >
              Map &amp; Trail Data
            </div>
            <div className="form-group">
              <label className="form-label">Google Maps URL</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://www.google.com/maps/@15.717,119.935,14z"
                value={form.googleMapsUrl}
                onChange={(e) => set("googleMapsUrl", e.target.value)}
              />
              <div className="form-hint">
                Open Google Maps, navigate to the location, then copy the URL from the browser address bar and paste it here.
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">AllTrails Trail URL</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://www.alltrails.com/trail/philippines/..."
                value={form.allTrailsUrl}
                onChange={(e) => set("allTrailsUrl", e.target.value)}
              />
              <div className="form-hint">
                Paste the AllTrails trail page URL — the embed widget will
                appear on the event page.
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Strava Route URL</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://www.strava.com/routes/..."
                value={form.stravaUrl}
                onChange={(e) => set("stravaUrl", e.target.value)}
              />
              <div className="form-hint">
                Strava route link — participants can follow or export to their GPS device.
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Coros Route URL</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://www.coros.com/route/..."
                value={form.corosUrl}
                onChange={(e) => set("corosUrl", e.target.value)}
              />
              <div className="form-hint">
                Coros route link — participants can sync directly to their Coros watch.
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

          {/* ── Expenses ── */}
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
                Estimated Expenses
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() =>
                  addListItem("expenses", {
                    label: "",
                    amount: "TBA",
                    note: "",
                    optional: false,
                  })
                }
              >
                + Add Expense
              </button>
            </div>
            {form.expenses.map((exp, i) => (
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
                  value={exp.label}
                  onChange={(e) =>
                    updateListItem("expenses", i, {
                      ...exp,
                      label: e.target.value,
                    })
                  }
                  style={{ flex: "2 1 160px" }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Amount"
                  value={exp.amount}
                  onChange={(e) =>
                    updateListItem("expenses", i, {
                      ...exp,
                      amount: e.target.value,
                    })
                  }
                  style={{ flex: "1 1 80px" }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Note (optional)"
                  value={exp.note}
                  onChange={(e) =>
                    updateListItem("expenses", i, {
                      ...exp,
                      note: e.target.value,
                    })
                  }
                  style={{ flex: "2 1 160px" }}
                />
                <label
                  style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8rem", whiteSpace: "nowrap", cursor: "pointer" }}
                  title="Optional fees let participants choose whether to include them"
                >
                  <input
                    type="checkbox"
                    checked={!!exp.optional}
                    onChange={(e) =>
                      updateListItem("expenses", i, { ...exp, optional: e.target.checked })
                    }
                  />
                  Optional
                </label>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeListItem("expenses", i)}
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
                  addListItem("officers", { name: "", role: "", contact: "" })
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
                <input
                  type="text"
                  className="form-input"
                  placeholder="Role (e.g. Climb Leader)"
                  value={o.role}
                  onChange={(e) =>
                    updateListItem("officers", i, {
                      ...o,
                      role: e.target.value,
                    })
                  }
                  style={{ flex: "2 1 140px" }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contact"
                  value={o.contact}
                  onChange={(e) =>
                    updateListItem("officers", i, {
                      ...o,
                      contact: e.target.value,
                    })
                  }
                  style={{ flex: "2 1 140px" }}
                />
                <select
                  className="form-select"
                  value={o.userId || ""}
                  onChange={(e) =>
                    updateListItem("officers", i, {
                      ...o,
                      userId: e.target.value,
                    })
                  }
                  style={{ flex: "2 1 180px" }}
                >
                  <option value="">— Link account (optional) —</option>
                  {users.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName || u.email}
                    </option>
                  ))}
                </select>
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
            <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)", marginBottom: 16 }}>
              These details are shown to registrants on the registration form so they know where to send payment.
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
                    style={{ width: 160, height: 160, objectFit: "contain", border: "1px solid var(--border)", borderRadius: 8, background: "#fff" }}
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
              {gcashUploading && <div className="form-hint">Uploading QR code…</div>}
              {form.gcashQrUrl && !gcashUploading && (
                <div className="form-hint" style={{ color: "var(--green-dark)" }}>QR code uploaded.</div>
              )}
            </div>
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
