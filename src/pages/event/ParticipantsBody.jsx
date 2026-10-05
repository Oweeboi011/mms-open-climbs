import LockedCard from "@/pages/event/LockedCard";
import "./event.css";

function NameList({ people }) {
  if (people.length === 0) return <p className="tbd-note participant-none">None yet.</p>;
  return (
    <ol className="participant-list">
      {people.map((p, i) => (
        <li key={i}>{p.name}</li>
      ))}
    </ol>
  );
}

function Group({ title, count, children }) {
  return (
    <div className="participant-group">
      <div className="participant-group-title">
        {title} {count !== undefined && <span className="participant-count">({count})</span>}
      </div>
      {children}
    </div>
  );
}

function Lists({ climb, participants }) {
  const members = participants.filter((p) => p.memberType === "member");
  const joiners = participants.filter((p) => p.memberType === "joiner");
  return (
    <>
      {climb.officers?.length > 0 && (
        <Group title="Climbing Officers">
          <ol className="participant-list">
            {climb.officers.map((o, i) => (
              <li key={i}>
                {o.name} <span className="participant-role">({o.role})</span>
              </li>
            ))}
          </ol>
        </Group>
      )}
      <Group title="MMS Members" count={members.length}>
        <NameList people={members} />
      </Group>
      <Group title="Joiners" count={joiners.length}>
        <NameList people={joiners} />
      </Group>
    </>
  );
}

// Who's joining. Registrants and admins see names (first name + last
// initial, published to climbPrivate by syncParticipantList); other signed-in
// members see only the count.
export default function ParticipantsBody({ climb, participants, currentUser, canSee, onSignIn }) {
  if (!currentUser) return <LockedCard label="Sign in to view the participant list" onUnlock={onSignIn} />;
  if (!canSee) {
    return (
      <p className="tbd-note participants-private">
        Only registered participants can see who&rsquo;s joining.{" "}
        {climb.registrationCount > 0 && `${climb.registrationCount} registered so far.`}
      </p>
    );
  }
  return <Lists climb={climb} participants={participants} />;
}
