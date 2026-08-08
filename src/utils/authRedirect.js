/**
 * Where an auth page should send the user once they're signed in.
 *
 * Two sources, because intent arrives two ways: an explicit `?redirect=` on
 * links built by the app (Event.jsx's register CTAs), and `state.from` pushed
 * by ProtectedRoute when it intercepts a deep link.
 */
export function resolveRedirect(location) {
  return (
    new URLSearchParams(location.search).get("redirect") ||
    location.state?.from?.pathname ||
    "/"
  );
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
