import { getOutstanding, getCountedPaid, serviceGroupsFromDoc } from "@/utils/registrationFees";
import { getRefundedTotal } from "@/utils/payments";
import { climbEndOf } from "@/utils/climbGrouping";

// A member's record across every climb, for the admin profile page:
// one row per registration (newest climb first) plus lifetime totals.
// `climbsById` and `privateById` are climbs/{id} and climbPrivate/{id} data
// for the climbs those registrations belong to.

function toMillis(t) {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (t instanceof Date) return t.getTime();
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t.toDate === "function") return t.toDate().getTime();
  return 0;
}

// What happened on the day, as far as the records show.
export function attendanceOf(reg, climb, now = new Date()) {
  if (reg.status === "cancelled") return "cancelled";
  if (reg.attended) return "present";
  if (reg.noShow) return "no-show";
  const end = climbEndOf(climb);
  if (end && end < now) return reg.status === "confirmed" ? "not recorded" : "—";
  return "upcoming";
}

export function buildMemberClimbs(regs = [], climbsById = {}, privateById = {}, now = new Date()) {
  const rows = regs
    .map((reg) => {
      const climb = climbsById[reg.climbId] || {};
      const groups = serviceGroupsFromDoc(privateById[reg.climbId]?.serviceGroups);
      const active = reg.status !== "cancelled";
      return {
        reg,
        climbId: reg.climbId,
        title: climb.title || reg.climbTitle || "(deleted climb)",
        dateLabel: climb.dateLabel || reg.climbDate || "",
        start: toMillis(climb.startDate) || new Date(climb.startDate || 0).getTime() || 0,
        status: reg.status,
        paymentStatus: reg.paymentStatus || "unpaid",
        paid: getCountedPaid(reg),
        refunded: getRefundedTotal(reg),
        owed: active ? getOutstanding(reg, climb, groups) : 0,
        attendance: attendanceOf(reg, climb, now),
        waiverSigned: !!reg.waiverSigned,
        donation: reg.donation || null,
        donationReceived: reg.donationReceived || null,
        memberType: reg.memberType || "",
      };
    })
    .sort((a, b) => b.start - a.start);

  const totals = {
    climbs: rows.filter((r) => r.status !== "cancelled").length,
    attended: rows.filter((r) => r.attendance === "present").length,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
    noShows: rows.filter((r) => r.attendance === "no-show").length,
    paid: Math.round(rows.reduce((s, r) => s + r.paid, 0) * 100) / 100,
    owed: Math.round(rows.reduce((s, r) => s + r.owed, 0) * 100) / 100,
    donated: Math.round(
      rows.reduce((s, r) => s + (Number(r.donationReceived?.cash) || 0), 0) * 100,
    ) / 100,
  };
  return { rows, totals };
}

// The most recent registration's safety details — what the member last told
// us, since the users/ profile itself doesn't hold them.
export function latestSafetyDetails(regs = []) {
  const latest = [...regs]
    .filter((r) => r.emergencyContact?.name || r.medicalConditions || r.mobile)
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))[0];
  if (!latest) return null;
  return {
    mobile: latest.mobile || "",
    emergencyContact: latest.emergencyContact || null,
    medicalConditions: latest.medicalConditions || "",
    fromClimb: latest.climbTitle || "",
  };
}

export function lastSeen(pageViews = []) {
  return pageViews.reduce((max, v) => Math.max(max, toMillis(v.timestamp)), 0);
}
