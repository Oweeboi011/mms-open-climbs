import { FieldError } from "@/pages/register/registerShared";
import { getGuestAge, MAX_GUESTS } from "@/utils/guests";

// Family or friends joining under this member's account — kids especially.
// Each guest takes a slot and owes the per-person fees; a fee can exempt young
// guests (the admin sets the age on the fee), so the date of birth is needed.
export default function GuestsSection({ bindField, climb, fieldErrors, form, setField }) {
  const guests = form.guests;
  const setGuests = (next) => setField("guests", next);
  const update = (i, patch) => setGuests(guests.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const remove = (i) => setGuests(guests.filter((_, j) => j !== i));
  const add = () => setGuests([...guests, { name: "", dateOfBirth: "", relationship: "" }]);

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
      {guests.map((guest, i) => {
        const age = getGuestAge(guest, climb);
        return (
          <div className="guest-row" key={i}>
            <div className="form-group guest-name">
              <label className="form-label required" htmlFor={`guest-name-${i}`}>
                Guest {i + 1} name
              </label>
              <input
                id={`guest-name-${i}`}
                type="text"
                className="form-input"
                maxLength={80}
                value={guest.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label required" htmlFor={`guest-dob-${i}`}>
                Date of birth
              </label>
              <input
                id={`guest-dob-${i}`}
                type="date"
                className="form-input"
                value={guest.dateOfBirth}
                onChange={(e) => update(i, { dateOfBirth: e.target.value })}
              />
              {age !== null && <div className="guest-age">Age {age} on the climb</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor={`guest-rel-${i}`}>
                Relationship
              </label>
              <input
                id={`guest-rel-${i}`}
                type="text"
                className="form-input"
                placeholder="e.g. Son, friend"
                maxLength={40}
                value={guest.relationship}
                onChange={(e) => update(i, { relationship: e.target.value })}
              />
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => remove(i)}>
              Remove guest {i + 1}
            </button>
          </div>
        );
      })}
      {guests.length < MAX_GUESTS && (
        <button type="button" className="btn btn-outline btn-sm" onClick={add}>
          + Add a guest
        </button>
      )}
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
