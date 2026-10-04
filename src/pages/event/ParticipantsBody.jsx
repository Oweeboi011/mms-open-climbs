import LockedCard from "@/pages/event/LockedCard";

// Who's joining. Registrants and admins see names (first name + last
// initial, published to climbPrivate by syncParticipantList); other signed-in
// members see only the count.
export default function ParticipantsBody({
  climb,
  participants,
  currentUser,
  canSee,
  onSignIn,
}) {
  return (
    <>
      {!currentUser ? (
        <LockedCard
          label="Sign in to view the participant list"
          onUnlock={onSignIn}
        />
      ) : !canSee ? (
        <p className="tbd-note participants-private">
          Only registered participants can see who&rsquo;s joining.{" "}
          {climb.registrationCount > 0 &&
            `${climb.registrationCount} registered so far.`}
        </p>
      ) : (
        (() => {
          const members = participants.filter(
            (p) => p.memberType === "member",
          );
          const joiners = participants.filter(
            (p) => p.memberType === "joiner",
          );
          const renderList = (list) =>
            list.length === 0 ? (
              <p className="tbd-note" style={{ marginBottom: 0 }}>
                None yet.
              </p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
                {list.map((p, i) => (
                  <li key={i} style={{ fontSize: "0.9rem" }}>
                    {p.name}
                  </li>
                ))}
              </ol>
            );
          return (
            <>
              {climb.officers?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: "var(--ink-soft)",
                      marginBottom: 8,
                    }}
                  >
                    Climbing Officers
                  </div>
                  <ol
                    style={{
                      margin: 0,
                      paddingLeft: 20,
                      lineHeight: 1.9,
                    }}
                  >
                    {climb.officers.map((o, i) => (
                      <li key={i} style={{ fontSize: "0.9rem" }}>
                        {o.name}{" "}
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--ink-soft)",
                          }}
                        >
                          ({o.role})
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                    marginBottom: 8,
                  }}
                >
                  MMS Members{" "}
                  <span style={{ fontWeight: 400 }}>
                    ({members.length})
                  </span>
                </div>
                {renderList(members)}
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                    marginBottom: 8,
                  }}
                >
                  Joiners{" "}
                  <span style={{ fontWeight: 400 }}>
                    ({joiners.length})
                  </span>
                </div>
                {renderList(joiners)}
              </div>
            </>
          );
        })()
      )}
    </>
  );
}
