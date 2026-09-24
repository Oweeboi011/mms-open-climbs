import { isClimbCompleted } from "@/utils/climbGrouping";

// Per-climb registration policy: a payment due date and a cancellation /
// refund policy, both set by admins in ClimbForm and shown to members before
// they register and on My Climbs. The wording is the club's; the app only
// carries it.

// `paymentDueDate` is stored as "YYYY-MM-DD" (same as preClimbMeetings).
function parseDueDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

export function formatDueDate(value) {
  const d = parseDueDate(value);
  return d
    ? d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
    : "";
}

// Past the end of the due day, with money still owed.
export function isPaymentOverdue(climb, outstanding, now = new Date()) {
  const due = parseDueDate(climb?.paymentDueDate);
  return !!due && outstanding > 0 && now > due;
}

// Members may withdraw themselves until the climb is over. Anything later
// (or undoing a cancellation) goes through an admin.
export const MEMBER_CANCELLABLE_STATUSES = ["pending", "confirmed", "waitlisted"];
export function canMemberCancel(reg, climb, now = new Date()) {
  return (
    MEMBER_CANCELLABLE_STATUSES.includes(reg?.status) &&
    !isClimbCompleted(climb, now)
  );
}

export const MEMBER_CANCELLATION_REASON =
  "You cancelled this registration from My Climbs. If you have paid, the " +
  "organizers will be in touch about any refund under this climb's " +
  "cancellation policy.";

// Exactly the fields firestore.rules lets a member change when cancelling.
export function buildMemberCancelPatch(timestamp) {
  return {
    status: "cancelled",
    cancelledByMember: true,
    cancellationReason: MEMBER_CANCELLATION_REASON,
    cancelledAt: timestamp,
    updatedAt: timestamp,
  };
}
