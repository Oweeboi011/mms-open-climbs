// A climb's history, newest first, from two sources:
//   - the admin audit log (every admin action, keyed by the registration or
//     climb it touched — which covers entries written before this existed);
//   - timestamps members and the server leave on registrations themselves
//     (registering, submitting payments, cancelling, auto-waitlisting,
//     promotion off the waitlist, attendance), which the audit log can't
//     hold because only admins write to it.

function toMillis(t) {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (t instanceof Date) return t.getTime();
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t.toDate === "function") return t.toDate().getTime();
  if (typeof t.seconds === "number") return t.seconds * 1000;
  return 0;
}

const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH")}`;

const ACTION_LABELS = {
  climb_created: "Created the climb",
  climb_updated: "Edited climb settings",
  climb_expenses_updated: "Updated expenses",
  service_groups_updated: "Changed service sharing groups",
  registration_edited: "Edited registration",
  registration_deleted: "Deleted registration",
  optional_fee_toggled: "Changed optional services",
  documents_submitted_by_admin: "Uploaded documents",
  payment_recorded: "Recorded a payment",
  payment_split: "Split a payment",
  payment_split_undone: "Undid a payment split",
  refund_recorded: "Recorded a refund",
  refund_removed: "Removed a refund",
  donation_recorded: "Recorded a donation",
  donation_cleared: "Cleared a donation record",
  registration_no_show_marked: "Marked no-show",
  registration_no_show_cleared: "Cleared no-show",
};

export function describeAction(action = "") {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  let m = action.match(/^registration_status_(\w+)$/);
  if (m) return `Set status to ${m[1]}`;
  m = action.match(/^payment_(?:status|entry)_(\w+)$/);
  if (m) return `Marked payment ${m[1]}`;
  return action.replace(/_/g, " ");
}

export function auditEntriesToEvents(entries = []) {
  return entries.map((e) => ({
    key: `audit-${e.id}`,
    at: toMillis(e.createdAt),
    who: e.actorName || "Admin",
    what: describeAction(e.action),
    subject: e.targetType === "climb" ? "" : e.targetLabel || "",
    detail: e.details || "",
    source: "admin",
  }));
}

export function registrationEvents(regs = []) {
  const events = [];
  for (const r of regs) {
    const name = r.name || "A participant";
    const push = (suffix, at, who, what, detail = "", source = "member") => {
      if (!toMillis(at)) return;
      events.push({ key: `${r.id}-${suffix}`, at: toMillis(at), who, what, subject: name, detail, source });
    };
    push("created", r.createdAt, r.userId ? name : "Admin", r.userId ? "Registered" : "Added as a walk-in");
    if (r.autoWaitlisted) {
      push("autowait", r.createdAt, "System", "Put on the waitlist (climb was full)", "", "system");
    }
    (r.payments || []).forEach((p, i) => {
      if (p.recordedBy) return; // an admin action — already in the audit log
      push(`pay${i}`, p.submittedAt, name, `Submitted a ${peso(p.amount)} payment`, p.note || "");
    });
    if (r.cancelledByMember) push("selfcancel", r.cancelledAt, name, "Cancelled from My Climbs");
    if (r.promotedFromWaitlistAt) {
      push("promoted", r.promotedFromWaitlistAt, "System", "Moved off the waitlist (a seat opened)", "", "system");
    }
    if (r.attended) push("present", r.attendedMarkedAt, r.attendedMarkedBy || "Admin", "Ticked present", "", "admin");
    if (r.privacyConsentAt) {
      push("consent", r.privacyConsentAt, name, "Agreed to the Privacy Notice", r.privacyNoticeVersion || "");
    }
  }
  return events;
}

export function buildClimbHistory(auditEntries = [], regs = []) {
  return [...auditEntriesToEvents(auditEntries), ...registrationEvents(regs)]
    .filter((e) => e.at > 0)
    .sort((a, b) => b.at - a.at);
}

// Firestore `in` takes at most 30 values per query.
export function chunk(list, size = 30) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
