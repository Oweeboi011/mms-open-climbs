import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

// Email/password accounts start unverified. Confirmations, receipts and
// reminders go to that address, so ask members to confirm it — without
// blocking them. Google sign-ins arrive verified and never see this.
export function needsEmailVerification(user) {
  return (
    !!user &&
    !user.emailVerified &&
    (user.providerData || []).some((p) => p?.providerId === "password")
  );
}

export default function VerifyEmailBanner() {
  const { currentUser, resendVerification } = useAuth();
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [, forceRender] = useState(0);

  if (!needsEmailVerification(currentUser)) return null;

  async function resend() {
    setState("sending");
    try {
      await resendVerification();
      setState("sent");
    } catch {
      setState("error");
    }
  }

  async function recheck() {
    try {
      await currentUser.reload();
    } finally {
      forceRender((n) => n + 1);
    }
  }

  return (
    <div className="verify-email-banner" role="status">
      <span>
        Please verify your email <strong>{currentUser.email}</strong> — we send
        your confirmations and receipts there.
      </span>
      <span className="verify-email-actions">
        {state === "sent" ? (
          <span>Sent — check your inbox.</span>
        ) : (
          <button
            className="btn btn-outline btn-sm"
            onClick={resend}
            disabled={state === "sending"}
          >
            {state === "error" ? "Try again" : "Resend email"}
          </button>
        )}
        <button className="btn btn-outline btn-sm" onClick={recheck}>
          I&rsquo;ve verified
        </button>
      </span>
    </div>
  );
}
