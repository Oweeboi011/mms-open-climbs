/**
 * Where an auth page should send the user once they're signed in.
 *
 * Two sources, because intent arrives two ways: an explicit `?redirect=` on
 * links built by the app (Event.jsx's register CTAs), and `state.from` pushed
 * by ProtectedRoute when it intercepts a deep link.
 */

const SLASH = 47;
const BACKSLASH = 92;
const SPACE = 32;
const DEL = 127;

// Only ever hand back a path inside this app.
//
// `?redirect=` is attacker-controllable — anyone can send a member a link to
// our own /login carrying any redirect they like. Handing that straight to
// navigate() turns the sign-in page into an open redirect: the victim types
// real credentials on the real site, then lands somewhere else entirely,
// which is the exact shape a phishing chain wants.
//
// A safe target starts with a single "/" and names no host. The rejections
// that matter: a second slash or a backslash at index 1 is protocol-relative
// (browsers normalise the backslash into a slash), and an absolute URL names
// its own host. Whitespace and control characters are refused too, since the
// browser strips them and can reveal a scheme these checks could not see.
function isSafeInternalPath(target) {
  if (typeof target !== "string" || target.length === 0) return false;
  if (target.charCodeAt(0) !== SLASH) return false;
  const second = target.charCodeAt(1);
  if (second === SLASH || second === BACKSLASH) return false;
  for (let i = 0; i < target.length; i++) {
    const code = target.charCodeAt(i);
    if (code <= SPACE || code === DEL) return false;
  }
  return true;
}

export function resolveRedirect(location) {
  const candidates = [
    new URLSearchParams(location.search).get("redirect"),
    location.state?.from?.pathname,
  ];
  return candidates.find(isSafeInternalPath) || "/";
}

/**
 * The `to` for the link between /login and /signup, carrying the pending
 * redirect across. Without this a visitor who clicks "Sign In to Register",
 * realises they have no account, and switches pages loses the climb entirely.
 */
export function authLinkWithRedirect(path, from) {
  return from && from !== "/"
    ? `${path}?redirect=${encodeURIComponent(from)}`
    : path;
}
