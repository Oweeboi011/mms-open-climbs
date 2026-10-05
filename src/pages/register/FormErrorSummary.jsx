import { FIELD_ORDER } from "@/pages/register/registerShared";
import "./register.css";

// What's wrong with the form, in field order, above the form itself.
export default function FormErrorSummary({ error, fieldErrors }) {
  if (!error) return null;
  return (
    <div className="alert alert-error" role="alert">
      <div>
        <div>{error}</div>
        {Object.keys(fieldErrors).length > 0 && (
          <ul className="form-error-list">
            {FIELD_ORDER.filter((k) => fieldErrors[k]).map((k) => (
              <li key={k}>{fieldErrors[k]}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
