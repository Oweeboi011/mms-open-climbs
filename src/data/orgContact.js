// Public contact point for MMS Open Climbs, surfaced in the footer and to
// signed-out visitors on the event page. Set one of these when finalized —
// everything derives from them, and the UI degrades to plain text (no broken
// link) while they're blank.
export const ORG_CONTACT_EMAIL = ""; // e.g. "openclimbs@example.org"
export const ORG_CONTACT_URL = ""; // optional fallback — a Facebook page or form

// Pure resolver so the derivation is testable without reaching into module
// constants. Prefers email (as a mailto: with an optional subject), then a
// plain URL, then null.
export function resolveContactHref({ email, url } = {}, subject) {
  if (email) {
    const q = subject ? `?subject=${encodeURIComponent(subject)}` : "";
    return `mailto:${email}${q}`;
  }
  return url || null;
}

export function resolveContactLabel({ email, url } = {}) {
  return email || url || "your MMS Open Climbs Coordinator";
}

export function contactHref(subject) {
  return resolveContactHref(
    { email: ORG_CONTACT_EMAIL, url: ORG_CONTACT_URL },
    subject,
  );
}

export function contactLabel() {
  return resolveContactLabel({
    email: ORG_CONTACT_EMAIL,
    url: ORG_CONTACT_URL,
  });
}
