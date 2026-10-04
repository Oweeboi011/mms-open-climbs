import { useId } from "react";

// A labelled text input (or textarea with `rows`), with the label tied to the
// control so screen readers announce it and clicking the label focuses it.
export default function TextField({
  label,
  value,
  onChange,
  required = false,
  hint,
  rows,
  type = "text",
  ...inputProps
}) {
  const id = useId();
  const control =
    rows !== undefined ? (
      <textarea
        id={id}
        className="form-textarea"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps}
      />
    ) : (
      <input
        id={id}
        type={type}
        className="form-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps}
      />
    );
  return (
    <div className="form-group">
      <label htmlFor={id} className={required ? "form-label required" : "form-label"}>
        {label}
      </label>
      {control}
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  );
}
