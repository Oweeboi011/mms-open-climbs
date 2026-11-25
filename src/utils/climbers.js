// Who is climbing which trail on a multi-trail climb. A trail's fees share a
// label prefix before " - " ("Mt. TENGLAWAN - Guide Fee"); a registrant
// climbs a trail when any of its fees is on their bill. Pure — no I/O.
import { getFeeItems } from "@/utils/registrationFees";

export function trailOf(label) {
  const i = String(label || "").indexOf(" - ");
  return i > 0 ? label.slice(0, i).trim() : null;
}

// { trails: [{ name, climbers: [reg] }], none: [reg] } for active registrants.
export function groupClimbersByTrail(regs, climb) {
  const names = [];
  (climb?.fees || []).forEach((fee) => {
    const t = trailOf(fee.label);
    if (t && !names.includes(t)) names.push(t);
  });
  const trails = names.map((name) => ({ name, climbers: [] }));
  const none = [];
  (regs || [])
    .filter((reg) => reg.status !== "cancelled")
    .forEach((reg) => {
      const mine = new Set(
        getFeeItems(reg, climb).map((f) => trailOf(f.label)).filter(Boolean),
      );
      trails.forEach((t) => mine.has(t.name) && t.climbers.push(reg));
      if (mine.size === 0) none.push(reg);
    });
  const byName = (a, b) => (a.name || "").localeCompare(b.name || "");
  trails.forEach((t) => t.climbers.sort(byName));
  none.sort(byName);
  return { trails, none };
}
