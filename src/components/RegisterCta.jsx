import { Link } from "react-router-dom";

// The call-to-action block in the event hero. Its job is to always give the
// viewer their next step: register, sign in, make an account, or (when signed
// in and the climb isn't taking registrations) explain why not.
export default function RegisterCta({
  climbId,
  isCancelled,
  isPostponed,
  isOpen,
  alreadyReg,
  regStatus,
  currentUser,
  isFull,
}) {
  const style = { marginTop: 20, display: "inline-flex" };
  if (alreadyReg) {
    return (
      <div className="alert alert-success" style={style}>
        You are registered &mdash; Status:{" "}
        <strong style={{ marginLeft: 4 }}>{regStatus}</strong>
      </div>
    );
  }
  // A signed-out visitor always gets a way in, even on a cancelled / closed /
  // full climb — slots open up and new climbs get scheduled, and an account is
  // what lets them be ready. The climb-state alerts below are only reached once
  // signed in.
  if (!currentUser) {
    const unavailable = isCancelled || isPostponed || !isOpen || isFull;
    return (
      <div style={{ marginTop: 20 }}>
        {unavailable && (
          <p className="alert alert-warning" style={{ marginBottom: 12 }}>
            Registration isn&rsquo;t open for this climb right now — but create a
            free account and you&rsquo;ll be ready for the next one.
          </p>
        )}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            to={`/login?redirect=/register/${climbId}`}
            className="btn btn-gold btn-lg"
          >
            {unavailable ? "Sign In" : "Sign In to Register"}
          </Link>
          <Link
            to={`/signup?redirect=/register/${climbId}`}
            className="btn btn-outline btn-lg"
          >
            Create a free account
          </Link>
        </div>
      </div>
    );
  }
  // The hero banner above already states the cancellation and carries the
  // reason — this slot only needs to explain what it means for registering.
  if (isCancelled) {
    return (
      <div className="alert alert-error" style={style}>
        Registration is closed — this climb has been cancelled.
      </div>
    );
  }
  if (isPostponed) {
    return (
      <div className="alert alert-warning" style={style}>
        Registration is on hold — this climb has been postponed.
      </div>
    );
  }
  if (!isOpen) {
    return (
      <div className="alert alert-warning" style={style}>
        Registration is currently closed for this climb.
      </div>
    );
  }
  if (isFull) {
    return (
      <div className="alert alert-warning" style={style}>
        This climb is full. Slots occasionally open up &mdash; check back, or
        watch the schedule for the next one.
      </div>
    );
  }
  return (
    <Link
      to={`/register/${climbId}`}
      className="btn btn-gold btn-lg"
      style={style}
    >
      Register Now &#8594;
    </Link>
  );
}
