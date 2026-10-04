import CancellationStatusFields from "@/components/admin/CancellationStatusFields";
import { COLOR_OPTIONS } from "@/pages/admin/climbForm/climbFormShared";

export default function BasicInfoFields({ form, set, setForm }) {
  return (
    <>
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
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <CancellationStatusFields form={form} setForm={setForm} />
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
    </>
  );
}
