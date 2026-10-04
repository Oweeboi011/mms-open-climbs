// localStorage / sessionStorage throw in some privacy modes (Safari private
// browsing, blocked site data). Everything here degrades to "nothing stored"
// instead of crashing the page that asked.
function safe(area) {
  return {
    get(key) {
      try {
        return window[area].getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        window[area].setItem(key, value);
      } catch {
        // Not persisted — callers treat storage as a convenience only.
      }
    },
  };
}

export const localStore = safe("localStorage");
export const sessionStore = safe("sessionStorage");
