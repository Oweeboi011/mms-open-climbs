// A ticked list of fee units (a whole trail, or a single fee) an admin can
// switch on or off; `value` is the list of fee labels that are switched on.
export default function FeeUnitChecklist({ legend, units, value, onChange }) {
  if (units.length === 0) return null;
  const isOn = (unit) => unit.labels.every((l) => value.includes(l));
  const toggle = (unit) => {
    const rest = value.filter((l) => !unit.labels.includes(l));
    onChange(isOn(unit) ? rest : [...rest, ...unit.labels]);
  };
  return (
    <fieldset className="guest-exclusions">
      <legend>{legend}</legend>
      {units.map((unit) => (
        <label key={unit.key} className="guest-exclusion">
          <input type="checkbox" checked={isOn(unit)} onChange={() => toggle(unit)} />
          {unit.label}
        </label>
      ))}
    </fieldset>
  );
}
