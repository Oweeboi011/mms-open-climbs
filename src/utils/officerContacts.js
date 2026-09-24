// Climb docs are publicly readable, so officer email addresses are kept in the
// admin-only climbInternal/{climbId} doc as `officerEmails`, index-aligned
// with climb.officers. The Cloud Functions read them from there to send
// officer notifications; names, roles and phone contacts stay public.

// Splits the form's officers into what the public climb doc may hold and the
// private email list.
export function splitOfficerEmails(officers = []) {
  return {
    publicOfficers: officers.map((o) => {
      const copy = { ...o };
      delete copy.email;
      return copy;
    }),
    officerEmails: officers.map((o) => ({
      name: o.name || "",
      email: o.email || "",
      userId: o.userId || "",
    })),
  };
}

// Folds the private emails back onto the public officers for editing. An
// email still on the public doc (climbs saved before the move) wins.
export function mergeOfficerEmails(officers = [], officerEmails = []) {
  return officers.map((o, i) => ({
    ...o,
    email: o.email || officerEmails[i]?.email || "",
  }));
}
