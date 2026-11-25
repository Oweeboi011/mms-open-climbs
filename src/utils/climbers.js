// Who is climbing which trail on a multi-trail climb. A trail's fees share a
// label prefix before " - " ("Mt. TENGLAWAN - Guide Fee"); a registrant
// climbs a trail when any of its fees is on their bill. Pure — no I/O.
import {
  getCountedPaid,
  getFeeItems,
  getOutstanding,
} from "@/utils/registrationFees";

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

// Active registrants with the climb's transportation fee on their bill, each
// with where their payment stands overall (a payment covers the whole bill,
// not one fee): "paid" with nothing left to pay, "partial" with something
// paid, else "unpaid".
export function getTransportRiders(regs, climb, serviceGroups = {}) {
  const isTransport = (f) => !trailOf(f.label) && /transp/i.test(f.label || "");
  return (regs || [])
    .filter((reg) => reg.status !== "cancelled")
    .filter((reg) => getFeeItems(reg, climb, serviceGroups).some(isTransport))
    .map((reg) => {
      const left = getOutstanding(reg, climb, serviceGroups);
      const paid = getCountedPaid(reg);
      const payStatus = left <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
      return { reg, payStatus };
    })
    .sort((a, b) => (a.reg.name || "").localeCompare(b.reg.name || ""));
}

// Active registrants without the transportation fee on their bill — they get
// to the climb on their own. Only meaningful when the climb sells transport.
export function getOwnTransport(regs, climb, serviceGroups = {}) {
  const riding = new Set(
    getTransportRiders(regs, climb, serviceGroups).map((r) => r.reg.id),
  );
  return (regs || [])
    .filter((reg) => reg.status !== "cancelled" && !riding.has(reg.id))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

// Transport riders grouped by pickup point: the climb's points in order, then
// anyone not assigned one yet.
export function groupRidersByPickup(riders, climb) {
  const points = climb?.pickupPoints || [];
  const groups = points.map((name) => ({
    name,
    riders: riders.filter((r) => r.reg.pickupPoint === name),
  }));
  const unset = riders.filter((r) => !points.includes(r.reg.pickupPoint));
  return { groups, unset };
}
