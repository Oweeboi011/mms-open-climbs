import TrailMapsEditor from "@/pages/admin/climbForm/TrailMapsEditor";
import TrailPhotosEditor from "@/pages/admin/climbForm/TrailPhotosEditor";
import { DIFFICULTY_DESCRIPTIONS, DIFFICULTY_LABELS, DIFFICULTY_VALUES, TRAIL_CLASS_DESCRIPTIONS, TRAIL_CLASS_LABELS, TRAIL_CLASS_VALUES } from "@/utils/trailClass";

export default function MountainProfileFields({
  addListItem,
  form,
  handleTrailImageUpload,
  removeListItem,
  set,
  setTrailUrlInput,
  trailImgUploading,
  trailUrlInput,
  updateListItem,
}) {
  return (
    <>
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
            <select
              className="form-select"
              value={form.difficulty}
              onChange={(e) => set("difficulty", e.target.value)}
            >
              <option value="">— Not specified —</option>
              {DIFFICULTY_VALUES.map((n) => (
                <option key={n} value={`${n}/9`}>
                  {n}/9 — {DIFFICULTY_LABELS[n]}
                </option>
              ))}
            </select>
            {(() => {
              const n = parseInt(form.difficulty, 10);
              return (
                DIFFICULTY_DESCRIPTIONS[n] && (
                  <p className="form-hint">{DIFFICULTY_DESCRIPTIONS[n]}</p>
                )
              );
            })()}
          </div>
          <div className="form-group">
            <label className="form-label">Trail Class</label>
            <select
              className="form-select"
              value={form.trailClass}
              onChange={(e) => set("trailClass", e.target.value)}
            >
              <option value="">— Not specified —</option>
              {TRAIL_CLASS_VALUES.map((n) => (
                <option key={n} value={n}>
                  Class {n} — {TRAIL_CLASS_LABELS[n]}
                </option>
              ))}
            </select>
            {form.trailClass && TRAIL_CLASS_DESCRIPTIONS[form.trailClass] && (
              <p className="form-hint">
                {TRAIL_CLASS_DESCRIPTIONS[form.trailClass]}
              </p>
            )}
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
        <TrailMapsEditor
          addListItem={addListItem}
          form={form}
          removeListItem={removeListItem}
          updateListItem={updateListItem}
        />
        <TrailPhotosEditor
          form={form}
          handleTrailImageUpload={handleTrailImageUpload}
          set={set}
          setTrailUrlInput={setTrailUrlInput}
          trailImgUploading={trailImgUploading}
          trailUrlInput={trailUrlInput}
        />
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
    </>
  );
}
