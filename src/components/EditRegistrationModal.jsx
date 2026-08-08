import { useState } from "react";
import { getPaymentEntries, getPaymentsTotal } from "@/utils/payments";
import { getExpectedTotal } from "@/utils/registrationFees";
import { formatPeso } from "@/utils/feeSummary";

export default function EditRegistrationModal({ reg, climb, onClose, onSave }) {
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
    memberType: reg.memberType || "joiner",
  });
  const [saving, setSaving] = useState(false);

  // Participant type drives the guest fee (registrationFees.js), so changing
  // it changes what this person owes. Show the delta rather than letting the
  // balance move silently after the modal closes.
  const memberTypeChanged = form.memberType !== (reg.memberType || "joiner");
  const currentExpected = climb ? getExpectedTotal(reg, climb) : null;
  const projectedExpected = climb
    ? getExpectedTotal({ ...reg, memberType: form.memberType }, climb)
    : null;
  const showFeeDelta =
    memberTypeChanged &&
    currentExpected !== null &&
    projectedExpected !== currentExpected;

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
        memberType: form.memberType,
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
            <label className="form-label">Participant Type</label>
            <select
              className="form-select"
              value={form.memberType}
              onChange={(e) => set("memberType", e.target.value)}
            >
              <option value="member">MMS Member</option>
              <option value="joiner">Joiner (non-member)</option>
            </select>
            {showFeeDelta ? (
              <div className="alert alert-warning" style={{ marginTop: 8 }}>
                Expected total changes from{" "}
                <strong>{formatPeso(currentExpected)}</strong> to{" "}
                <strong>{formatPeso(projectedExpected)}</strong>
                {projectedExpected < currentExpected
                  ? " — the guest fee no longer applies."
                  : " — the guest fee now applies."}{" "}
                Their outstanding balance updates on save.
              </div>
            ) : (
              <div className="form-hint">
                The registration form defaults to Joiner, so a member who
                skipped it is charged the guest fee. Correcting this here
                recalculates what they owe.
              </div>
            )}
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
