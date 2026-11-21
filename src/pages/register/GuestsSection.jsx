import GuestsFields from "@/components/GuestsFields";
import { FieldError } from "@/pages/register/registerShared";

// Family or friends joining under this member's account — kids especially.
// Each guest takes a slot and owes the per-person fees; a fee can exempt young
// guests (the admin sets the age on the fee), so the date of birth is needed.
export default function GuestsSection({ bindField, climb, fieldErrors, form, setField }) {
  const guests = form.guests;
  const max = Number(climb.maxParticipants) || 0;
  const taken = climb.registrationCount ?? 0;
  const overCapacity = max > 0 && taken + 1 + guests.length > max;

  return (
    <div className="register-form-card" ref={bindField("guests")} tabIndex={-1}>
      <div className="form-section-title">Guests (optional)</div>
      <p className="guest-hint">
        Bringing kids or family who don&rsquo;t have an account? Add them here. Each guest takes a
        slot and pays the per-person fees. Some fees, like transportation, can be free for young
        children.
      </p>
      <GuestsFields guests={guests} onChange={(g) => setField("guests", g)} climb={climb} />
      {guests.length > 0 && (
        <label className="guest-consent">
          <input
            type="checkbox"
            checked={form.guestsAuthorized}
            onChange={(e) => setField("guestsAuthorized", e.target.checked)}
          />
          I am the parent or guardian of any guest under 18, or otherwise authorised to register
          them, and the waiver I sign below covers my guests.
        </label>
      )}
      {overCapacity && (
        <div className="alert alert-warning" role="status">
          Your group is larger than the slots left, so this registration will be placed on the
          waitlist.
        </div>
      )}
      <FieldError message={fieldErrors.guests} />
    </div>
  );
}
