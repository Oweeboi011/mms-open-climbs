import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { recordPageView } from "@/services/analytics";
import { sessionStore } from "@/services/browserStorage";

function getSessionId() {
  let id = sessionStore.get("oc_session_id");
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStore.set("oc_session_id", id);
  }
  return id;
}

export function usePageTracking() {
  const location = useLocation();
  const { currentUser, userProfile } = useAuth();
  const lastTracked = useRef(null);

  useEffect(() => {
    // Do not track admin pages
    if (location.pathname.startsWith("/admin")) return;

    // Avoid double-counting same path within the same render cycle (React Strict Mode etc.)
    const key = location.pathname;
    if (lastTracked.current === key) return;
    lastTracked.current = key;

    const climbMatch = location.pathname.match(/^\/event\/(.+)/);
    const climbId = climbMatch ? climbMatch[1] : null;

    let userRole = "guest";
    if (currentUser) {
      userRole = userProfile?.role === "admin" ? "admin" : "member";
    }

    recordPageView({
      path: location.pathname,
      climbId: climbId ?? null,
      userId: currentUser?.uid ?? null,
      userRole,
      sessionId: getSessionId(),
    });
  }, [location.pathname, currentUser, userProfile]);
}
