import { guestFeeUnits } from "@/utils/climbers";

// Admin: what a guest does not take part in. Ticked items come off the
// member's bill and the guest drops out of that trail or the van.
export default function GuestExclusions({ guest, index, climb, onChange }) {
  const units = guestFeeUnits(climb);
  if (units.length === 0) return null;
  const excluded = guest.excludedFees || [];
  const isOut = (unit) => unit.labels.every((l) => excluded.includes(l));
  const toggle = (unit) => {
    const rest = excluded.filter((l) => !unit.labels.includes(l));
    onChange(isOut(unit) ? rest : [...rest, ...unit.labels]);
  };
  return (
    <fieldset className="guest-exclusions">
      <legend>Guest {index + 1} doesn&apos;t take part in</legend>
      {units.map((unit) => (
        <label key={unit.key} className="guest-exclusion">
          <input
            type="checkbox"
            checked={isOut(unit)}
            onChange={() => toggle(unit)}
          />
          {unit.label}
        </label>
      ))}
    </fieldset>
  );
}
