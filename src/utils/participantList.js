// The registrants-only "who's joining" list kept in climbPrivate/{climbId}
// (first name + last initial, pending and confirmed only). Mirrors
// shortName/syncParticipantList in functions/src/index.js, which rebuild it
// on every registration change; the admin climb page uses this to repair a
// list that is missing or stale (climbs from before the list existed).
export function shortName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Participant";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export function buildParticipantList(regs = []) {
  return regs
    .filter((r) => r.status === "pending" || r.status === "confirmed")
    .map((r) => ({ name: shortName(r.name), memberType: r.memberType || "" }));
}

export function participantListDiffers(stored, next) {
  return JSON.stringify(stored || null) !== JSON.stringify(next);
}
