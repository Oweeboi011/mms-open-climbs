// Wraps Date.now() so components can compute "age in days" style stats
// without calling the impure Date.now() directly inline during render.
export function nowMs() {
  return Date.now();
}
