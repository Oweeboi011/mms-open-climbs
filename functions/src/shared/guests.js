"use strict";

// Server-side mirror of src/utils/guests.js. Guests are family a member
// registers under their own account; they take a slot and owe per-person fees,
// except where a fee's `guestFreeUpToAge` exempts young ones.

function regHeadcount(reg) {
  return 1 + (Array.isArray(reg && reg.guests) ? reg.guests.length : 0);
}

function parseIso(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return m ? { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) } : null;
}

function climbStartIso(climb) {
  const raw = climb && climb.startDate;
  if (typeof raw === "string") return parseIso(raw) ? raw : "";
  const date = raw && raw.toDate ? raw.toDate() : null;
  if (!date || isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function ageOn(dateOfBirth, onIso) {
  const dob = parseIso(dateOfBirth);
  const on = parseIso(onIso);
  if (!dob || !on) return null;
  let age = on.y - dob.y;
  if (on.mo < dob.mo || (on.mo === dob.mo && on.d < dob.d)) age -= 1;
  return age >= 0 ? age : null;
}

function guestOwesFee(guest, fee, climb, memberAvails) {
  if (fee.shareable) return false;
  if (fee.optional && !fee.isGuestFee && !memberAvails) return false;
  const freeUpTo = Number(fee.guestFreeUpToAge);
  if (fee.guestFreeUpToAge === undefined || fee.guestFreeUpToAge === null || !Number.isFinite(freeUpTo)) {
    return true;
  }
  const onIso = climbStartIso(climb) || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const age = ageOn(guest && guest.dateOfBirth, onIso);
  return age === null || age > freeUpTo;
}

module.exports = { regHeadcount, guestOwesFee };
