// Pure helpers for the Users admin page.

const CREATE_USER_ERROR_INFO = {
  "already-exists": {
    title: "Account Already Exists",
    message: "An account with this email address already exists in the system.",
    nextStep:
      'Check the Users list to see if this person is already registered. If they can\'t log in, ask them to use "Forgot Password" on the login page instead of creating a new account.',
  },
  "permission-denied": {
    title: "Not Authorized",
    message: "Only admin accounts are allowed to create new users.",
    nextStep:
      "Confirm your account has the admin role. If you believe this is a mistake, ask another admin to check your role under Users management.",
  },
  "invalid-argument": {
    title: "Missing Information",
    message: "Email address and full name are both required to create an account.",
    nextStep: "Fill in both fields and try submitting again.",
  },
  unauthenticated: {
    title: "Session Expired",
    message: "You are no longer signed in.",
    nextStep: "Log out and log back in, then try creating the account again.",
  },
  unavailable: {
    title: "Connection Problem",
    message: "Couldn't reach the server to create this account.",
    nextStep: "Check your internet connection and try again in a moment.",
  },
  "deadline-exceeded": {
    title: "Request Timed Out",
    message: "The server took too long to respond.",
    nextStep: "Try again. If it keeps timing out, contact tech support.",
  },
  internal: {
    title: "Server Error",
    message: "Something went wrong on the server while creating this account.",
    nextStep:
      "Wait a moment and try again. If the problem continues, contact tech support and mention the email address you were trying to add.",
  },
};

export function describeCreateUserError(err) {
  const code = (err?.code || "").replace(/^functions\//, "");
  const known = CREATE_USER_ERROR_INFO[code];
  if (known) return { ...known, raw: err?.message };
  return {
    title: "Something Went Wrong",
    message: err?.message || "An unexpected error occurred.",
    nextStep: "Try again. If this keeps happening, contact tech support with a description of what you were doing.",
    raw: err?.message,
  };
}

export const newestFirst = (users) =>
  [...users].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

export function matchesSearch(user, search) {
  if (!search) return true;
  const q = search.toLowerCase();
  return Boolean(user.displayName?.toLowerCase().includes(q) || user.email?.toLowerCase().includes(q));
}

export const ROLE_TONE = { admin: "warning", member: "success" };

export const addedByLabel = (user) => (user.addedBy === "self" ? "Self-registered" : "Admin");

export const joinedLabel = (user) => user.createdAt?.toDate?.().toLocaleDateString("en-PH") || "—";

export const initialOf = (user) => (user.displayName || user.email || "?")[0].toUpperCase();

// Only the fields that actually changed, trimmed; null when nothing did.
export function profileChanges(user, name, email) {
  const changes = {};
  if (name.trim() && name.trim() !== user.displayName) changes.displayName = name.trim();
  if (email.trim() && email.trim() !== user.email) changes.email = email.trim();
  return Object.keys(changes).length ? changes : null;
}
