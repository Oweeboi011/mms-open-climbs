import { getGuestAge, MAX_GUESTS } from "@/utils/guests";

// The editable list of guests (name, date of birth, relationship) shared by
// the register form and the admin edit-registration modal. With `byAge`
// (admins) the date of birth is replaced by an age on the climb date.
export default function GuestsFields({
  guests,
  onChange,
  climb,
  byAge = false,
}) {
  const update = (i, patch) =>
    onChange(guests.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const remove = (i) => onChange(guests.filter((_, j) => j !== i));
  const add = () =>
    onChange([
      ...guests,
      byAge
        ? { name: "", age: "", relationship: "" }
        : { name: "", dateOfBirth: "", relationship: "" },
    ]);

  return (
    <>
      {guests.map((guest, i) => {
        const age = getGuestAge(guest, climb);
        return (
          <div className="guest-row" key={i}>
            <div className="form-group guest-name">
              <label
                className="form-label required"
                htmlFor={`guest-name-${i}`}
              >
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
            {byAge ? (
              <div className="form-group">
                <label
                  className="form-label required"
                  htmlFor={`guest-age-${i}`}
                >
                  Age on the climb
                </label>
                <input
                  id={`guest-age-${i}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={120}
                  className="form-input"
                  value={age ?? ""}
                  onChange={(e) =>
                    update(i, {
                      age: e.target.value === "" ? "" : Number(e.target.value),
                      dateOfBirth: "",
                    })
                  }
                />
              </div>
            ) : (
              <div className="form-group">
                <label
                  className="form-label required"
                  htmlFor={`guest-dob-${i}`}
                >
                  Date of birth
                </label>
                <input
                  id={`guest-dob-${i}`}
                  type="date"
                  className="form-input"
                  value={guest.dateOfBirth}
                  onChange={(e) => update(i, { dateOfBirth: e.target.value })}
                />
                {age !== null && (
                  <div className="guest-age">Age {age} on the climb</div>
                )}
              </div>
            )}
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
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => remove(i)}
            >
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
    </>
  );
}
