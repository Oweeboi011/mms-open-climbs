// Guests a member registers under their own account — typically kids or
// family who join the climb without an account of their own. A guest is
// stored on the registration as `guests: [{ name, dateOfBirth, relationship }]`
// and takes a slot, pays per-person fees, and rides on the member's balance.
//
// Fee rule: a guest owes every per-person fee (required fees, the guest fee,
// and whichever optional services the member ticked), except that a fee can
// carry `guestFreeUpToAge` — guests that age or younger, on the climb's start
// date, skip it. That's how "kids 4 and under don't pay transportation" is
// expressed without matching on a fee's label. Shareable services (a porter
// split between climbers) are group units, never per guest.

export const MAX_GUESTS = 10;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(value) {
  const m = ISO_DATE.exec(String(value || ""));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  const valid =
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d;
  return valid ? { y, mo, d } : null;
}

function todayIso() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

// The climb's first day as YYYY-MM-DD, or "" when it has none.
function climbStartIso(climb) {
  const raw = climb?.startDate;
  if (typeof raw === "string") return parseIsoDate(raw) ? raw : "";
  const date = raw?.toDate ? raw.toDate() : raw instanceof Date ? raw : null;
  if (!date || isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

// Whole years old on `onIso`; null for a missing, malformed or future birthdate.
export function ageOn(dateOfBirth, onIso) {
  const dob = parseIsoDate(dateOfBirth);
  const on = parseIsoDate(onIso);
  if (!dob || !on) return null;
  let age = on.y - dob.y;
  if (on.mo < dob.mo || (on.mo === dob.mo && on.d < dob.d)) age -= 1;
  return age >= 0 ? age : null;
}

export function getGuests(reg) {
  return Array.isArray(reg?.guests) ? reg.guests : [];
}

// Seats a registration takes: the member plus their guests.
export function getHeadcount(reg) {
  return 1 + getGuests(reg).length;
}

// An admin can record just an age (on the climb date) instead of a birthdate.
export function isValidAge(age) {
  return Number.isInteger(age) && age >= 0 && age <= 120;
}

export function getGuestAge(guest, climb) {
  if (parseIsoDate(guest?.dateOfBirth))
    return ageOn(guest.dateOfBirth, climbStartIso(climb) || todayIso());
  return isValidAge(guest?.age) ? guest.age : null;
}

// Whether `guest` owes `fee`. `memberAvails` is whether the member ticked it
// (only consulted for optional services).
export function guestOwesFee(guest, fee, climb, memberAvails) {
  if (fee.shareable) return false;
  if (fee.optional && !fee.isGuestFee && !memberAvails) return false;
  const freeUpTo = parseFloat(fee.guestFreeUpToAge);
  if (!Number.isFinite(freeUpTo)) return true;
  const age = getGuestAge(guest, climb);
  // An unknown age can't earn the exemption.
  return age === null || age > freeUpTo;
}

// What the register form needs to say about the guests entered so far.
export function validateGuests(
  guests,
  onIso = todayIso(),
  { byAge = false } = {},
) {
  if (guests.length > MAX_GUESTS)
    return `You can add up to ${MAX_GUESTS} guests.`;
  for (let i = 0; i < guests.length; i += 1) {
    const g = guests[i];
    const label = `Guest ${i + 1}`;
    if (!String(g.name || "").trim()) return `${label}: enter their name.`;
    if (byAge && !parseIsoDate(g.dateOfBirth)) {
      if (!isValidAge(g.age))
        return `${label}: enter their age on the climb — it decides some fees.`;
      continue;
    }
    if (!parseIsoDate(g.dateOfBirth))
      return `${label}: enter their date of birth — their age decides some fees.`;
    if (ageOn(g.dateOfBirth, onIso) === null)
      return `${label}: the date of birth can't be in the future.`;
  }
  return "";
}

// Trimmed copies safe to store.
export function cleanGuests(guests) {
  return (guests || []).map((g) => ({
    name: String(g.name || "").trim(),
    ...(parseIsoDate(g.dateOfBirth)
      ? { dateOfBirth: g.dateOfBirth }
      : { age: g.age }),
    relationship: String(g.relationship || "").trim(),
  }));
}
