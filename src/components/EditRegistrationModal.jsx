import { useState } from "react";
import { getPaymentEntries, getPaymentsTotal } from "@/utils/payments";

export default function EditRegistrationModal({ reg, onClose, onSave }) {
  const [form, setForm] = useState({
    name: reg.name || "",
    mobile: reg.mobile || "",
    dateOfBirth: reg.dateOfBirth || "",
    address: reg.address || "",
    ecName: reg.emergencyContact?.name || "",
    ecMobile: reg.emergencyContact?.mobile || "",
    ecRelationship: reg.emergencyContact?.relationship || "",
    medicalConditions: reg.medicalConditions || "",
    amountPaid: reg.amountPaid ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(reg.id, {
        name: form.name,
        mobile: form.mobile,
        dateOfBirth: form.dateOfBirth,
        address: form.address,
        emergencyContact: {
          name: form.ecName,
          mobile: form.ecMobile,
          relationship: form.ecRelationship,
        },
        medicalConditions: form.medicalConditions,
        amountPaid: form.amountPaid === "" ? null : Number(form.amountPaid),
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
          maxWidth: 460,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>
          Edit Registration
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

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Mobile</label>
              <input
                type="tel"
                className="form-input"
                value={form.mobile}
                onChange={(e) => set("mobile", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input
                type="date"
                className="form-input"
                value={form.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input
              type="text"
              className="form-input"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Emergency Contact Name</label>
              <input
                type="text"
                className="form-input"
                value={form.ecName}
                onChange={(e) => set("ecName", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Emergency Contact Mobile</label>
              <input
                type="tel"
                className="form-input"
                value={form.ecMobile}
                onChange={(e) => set("ecMobile", e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Emergency Contact Relationship</label>
            <input
              type="text"
              className="form-input"
              value={form.ecRelationship}
              onChange={(e) => set("ecRelationship", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Medical Conditions</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={form.medicalConditions}
              onChange={(e) => set("medicalConditions", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Amount Paid (₱)</label>
            <input
              type="number"
              min="0"
              step="any"
              className="form-input"
              value={form.amountPaid}
              onChange={(e) => set("amountPaid", e.target.value)}
            />
            {getPaymentEntries(reg).length > 0 && (
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--ink-soft)",
                  marginTop: 4,
                }}
              >
                {getPaymentEntries(reg).length} payment
                {getPaymentEntries(reg).length > 1 ? "s" : ""} on record
                totalling ₱{getPaymentsTotal(reg).toLocaleString("en-PH")}. To
                log money actually received, use{" "}
                <strong>Record Payment</strong> instead — editing this figure
                overrides the total without adding to the history.
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
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
