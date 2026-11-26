// Who is climbing which trail on a multi-trail climb. A trail's fees share a
// label prefix before " - " ("Mt. TENGLAWAN - Guide Fee"); a registrant
// climbs a trail when any of its fees is on their bill. Pure — no I/O.
import { isExcluded } from "@/utils/guests";
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
        getFeeItems(reg, climb, {}, { includeSelfPaid: true })
          .map((f) => trailOf(f.label))
          .filter(Boolean),
      );
      trails.forEach((t) => mine.has(t.name) && t.climbers.push(reg));
      if (mine.size === 0) none.push(reg);
    });
  const byName = (a, b) => (a.name || "").localeCompare(b.name || "");
  trails.forEach((t) => t.climbers.sort(byName));
  none.sort(byName);
  return { trails, none };
}

// Active registrants with the climb's transportation fee on their bill — or a
// pickup point an admin assigned, which means they ride too — each
// with where their payment stands overall (a payment covers the whole bill,
// not one fee): "paid" with nothing left to pay, "partial" with something
// paid, else "unpaid".
export function getTransportRiders(regs, climb, serviceGroups = {}) {
  const isTransport = (f) => !trailOf(f.label) && /transp/i.test(f.label || "");
  return (regs || [])
    .filter((reg) => reg.status !== "cancelled")
    .filter(
      (reg) =>
        !!reg.pickupPoint ||
        getFeeItems(reg, climb, serviceGroups, { includeSelfPaid: true }).some(isTransport),
    )
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

// What an admin can take a guest out of: one entry per trail (all of its
// fees together) and one per other per-person fee.
export function guestFeeUnits(climb, { shareable = false } = {}) {
  const units = [];
  const byTrail = {};
  (climb?.fees || []).forEach((fee) => {
    if ((fee.shareable && !shareable) || fee.isGuestFee) return;
    const trail = trailOf(fee.label);
    if (!trail) {
      units.push({ key: fee.label, label: fee.label, labels: [fee.label] });
      return;
    }
    if (!byTrail[trail]) {
      byTrail[trail] = { key: trail, label: `${trail} (climbing)`, labels: [], trail: true };
      units.push(byTrail[trail]);
    }
    byTrail[trail].labels.push(fee.label);
  });
  return units;
}

const skipsAll = (guest, labels) =>
  labels.length > 0 && labels.every((l) => isExcluded(guest, l));

// Whether a guest is on a trail: their member's trail, unless every fee of
// that trail has been taken off the guest.
export function guestJoinsTrail(guest, climb, trail) {
  const labels = (climb?.fees || [])
    .filter((f) => trailOf(f.label) === trail)
    .map((f) => f.label);
  return !skipsAll(guest, labels);
}

// Whether a guest rides the van their member rides.
export function guestRides(guest, climb) {
  const labels = (climb?.fees || [])
    .filter((f) => !trailOf(f.label) && /transp/i.test(f.label || ""))
    .map((f) => f.label);
  return !skipsAll(guest, labels);
}

const isAccommodation = (fee) =>
  !fee.isGuestFee && !trailOf(fee.label) && /accom/i.test(fee.label || "");

// Who is staying where: one group per accommodation option the climb sells,
// plus active registrants who have picked none. Guests follow their member
// unless an admin took the stay off them (see guestStays).
export function groupByAccommodation(regs, climb) {
  const fees = (climb?.fees || []).filter(isAccommodation);
  const options = fees.map((fee) => ({ fee, guests: [], regs: [] }));
  const none = [];
  (regs || [])
    .filter((reg) => reg.status !== "cancelled")
    .forEach((reg) => {
      const mine = new Set(
        getFeeItems(reg, climb, {}, { includeSelfPaid: true }).map((f) => f.label),
      );
      const picked = options.filter((o) => mine.has(o.fee.label));
      picked.forEach((o) => o.regs.push(reg));
      if (picked.length === 0) none.push(reg);
    });
  const byName = (a, b) => (a.name || "").localeCompare(b.name || "");
  options.forEach((o) => o.regs.sort(byName));
  none.sort(byName);
  return { options, none };
}

export const guestStays = (guest, label) => !isExcluded(guest, label);
