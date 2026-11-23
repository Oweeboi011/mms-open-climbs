import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "@/components/Modal";
import { subscribeToClimb } from "@/services/climbs";
import { serverTimestamp } from "@/services/firestore";
import { updateRegistration } from "@/services/registrations";
import { formatPeso } from "@/utils/feeSummary";
import {
  getExpectedTotal,
  getOptionalServices,
  getOutstanding,
  isAvailing,
  toggleOptionalFeeEntry,
} from "@/utils/registrationFees";

// What a registration's feeBreakdown becomes once `wanted` ({ [label]: bool })
// is applied: only the services whose choice actually changed are toggled.
function applySelections(reg, climb, wanted) {
  let feeBreakdown = reg.feeBreakdown || [];
  for (const [label, on] of Object.entries(wanted)) {
    if (on === isAvailing({ ...reg, feeBreakdown }, label)) continue;
    feeBreakdown = toggleOptionalFeeEntry({ ...reg, feeBreakdown }, climb, label) || feeBreakdown;
  }
  return feeBreakdown;
}

function ServicesModal({ reg, onClose }) {
  const [climb, setClimb] = useState(null);
  const [wanted, setWanted] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(
    () =>
      subscribeToClimb(
        reg.climbId,
        (found) => {
          if (!found) return;
          setClimb(found);
          // Keep what the member has already ticked in this session.
          setWanted(
            (prev) =>
              prev ||
              Object.fromEntries(getOptionalServices(found).map((f) => [f.label, isAvailing(reg, f.label)])),
          );
        },
        () => setError("Could not load this climb's fees. Please try again."),
      ),
    [reg],
  );

  const services = climb ? getOptionalServices(climb) : [];
  const projected = climb && wanted ? { ...reg, feeBreakdown: applySelections(reg, climb, wanted) } : reg;
  const newTotal = climb ? getExpectedTotal(projected, climb) : 0;
  const newBalance = climb ? getOutstanding(projected, climb) : 0;

  async function save() {
    setSaving(true);
    setError("");
    try {
      await updateRegistration(reg.id, {
        feeBreakdown: applySelections(reg, climb, wanted),
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch {
      setError("Could not save your changes. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="update-services-title" size="md">
      <div>
        <h3 id="update-services-title" className="update-services-title">
          Update what I&rsquo;ll pay
        </h3>
        <p className="update-services-hint">
          Choose the optional services you&rsquo;re availing for <strong>{reg.climbTitle}</strong>. No payment
          proof is needed now — your balance updates and you can pay later from this page.
        </p>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        {climb && wanted && services.length === 0 && (
          <p className="update-services-hint">This climb has no optional services to choose from.</p>
        )}
        {climb &&
          wanted &&
          services.map((fee) => (
            <label key={fee.label} className="update-services-row">
              <input
                type="checkbox"
                checked={!!wanted[fee.label]}
                onChange={() => setWanted((p) => ({ ...p, [fee.label]: !p[fee.label] }))}
              />
              <span>{fee.label}</span>
              <span className="update-services-amount">{fee.amount || "TBA"}</span>
            </label>
          ))}
        {climb && wanted && (
          <div className="update-services-total">
            <div>
              Expected total <strong>{formatPeso(newTotal)}</strong>
            </div>
            <div>
              Balance after this change <strong>{formatPeso(newBalance)}</strong>
            </div>
          </div>
        )}
        <div className="update-services-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || !wanted}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// A card action: lets a member change which optional services they owe for,
// without submitting a payment.
export default function UpdateServicesButton({ reg }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="btn btn-outline btn-sm"
        onClick={() => setOpen(true)}
        title="Add or remove an optional service, e.g. transportation, without paying yet"
      >
        Update What I Pay
      </button>
      {/* Portaled out of the card: .reg-card clips overflow and shifts on hover,
          which would trap and distort a fixed-position dialog rendered inside it. */}
      {open && createPortal(<ServicesModal reg={reg} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
