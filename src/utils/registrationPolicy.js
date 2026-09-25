import { isClimbCompleted } from "@/utils/climbGrouping";
import { DEFAULT_CANCELLATION_POLICY } from "@/data/defaultCancellationPolicy";

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

// Without a due date of its own, payment is due this many days before the
// climb starts.
export const DEFAULT_DUE_DAYS_BEFORE = 5;

function toLocalYmd(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function climbStart(climb) {
  const raw = climb?.startDate;
  if (!raw) return null;
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = raw?.toDate?.() ?? new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// The climb's due date as "YYYY-MM-DD": its own, else DEFAULT_DUE_DAYS_BEFORE
// days before it starts, else "" (no dates set yet).
export function getPaymentDueDate(climb) {
  if (climb?.paymentDueDate) return climb.paymentDueDate;
  const start = climbStart(climb);
  if (!start) return "";
  const due = new Date(start);
  due.setDate(due.getDate() - DEFAULT_DUE_DAYS_BEFORE);
  return toLocalYmd(due);
}

export function isDefaultDueDate(climb) {
  return !climb?.paymentDueDate && !!getPaymentDueDate(climb);
}

// The climb's own policy, else the club-wide default.
export function getCancellationPolicy(climb) {
  return climb?.cancellationPolicy?.trim() || DEFAULT_CANCELLATION_POLICY;
}

export function isDefaultPolicy(climb) {
  return !climb?.cancellationPolicy?.trim();
}

// Past the end of the due day, with money still owed.
export function isPaymentOverdue(climb, outstanding, now = new Date()) {
  const due = parseDueDate(getPaymentDueDate(climb));
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
