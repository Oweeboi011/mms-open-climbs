// The club-wide cancellation & refund policy, used for any climb that
// doesn't set its own in ClimbForm. DRAFT wording for the club to confirm —
// the windows and percentages are policy decisions, not app behaviour.
export const DEFAULT_CANCELLATION_POLICY = [
  "To cancel, use Cancel Registration in My Climbs (or message the climb officers).",
  "• 15 days or more before the climb: full refund of fees paid, less anything already paid out on your behalf (permits, guide or porter fees, bookings).",
  "• 7 to 14 days before: 50% refund of fees paid, less anything already paid out on your behalf.",
  "• Less than 7 days before, or not showing up: no refund.",
  "If MMS cancels or postpones the climb, you can move to the new date or get a full refund of fees not yet spent.",
  "Refunds are sent by GCash within 14 days. Donations are not refundable once handed over.",
].join("\n");
