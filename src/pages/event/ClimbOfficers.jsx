import SectionCard from "@/components/SectionCard";
import { contactHref } from "@/data/orgContact";
import LockedCard from "@/pages/event/LockedCard";
import "./event.css";

function SignedOut({ climb, onUnlock }) {
  const href = contactHref(`Question about ${climb.title}`);
  return (
    <>
      <LockedCard label="Sign in to view the climb officers" onUnlock={onUnlock} />
      <p className="tbd-note event-note-after-lock">
        Questions about this climb?{" "}
        {href ? <a href={href}>Contact MMS Open Climbs</a> : "Contact your MMS Open Climbs Coordinator."}
      </p>
    </>
  );
}

export default function ClimbOfficers({ climb, currentUser, setShowSignInModal }) {
  let body;
  if (!currentUser) {
    body = <SignedOut climb={climb} onUnlock={() => setShowSignInModal(true)} />;
  } else if (climb.officers?.length > 0) {
    body = climb.officers.map((o, i) => (
      <div className="officer-row" key={i}>
        <div>
          <div className="officer-name">{o.name}</div>
          <div className="officer-role">{o.role}</div>
        </div>
        <div className="officer-contact">{o.contact}</div>
      </div>
    ));
  } else {
    body = <p className="tbd-note">Climb officers will be announced closer to the event date.</p>;
  }
  return (
    <SectionCard icon="users" title="Climb Officers">
      {body}
    </SectionCard>
  );
}
