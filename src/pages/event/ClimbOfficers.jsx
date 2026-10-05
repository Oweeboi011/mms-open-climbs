import Icon from "@/components/Icon";
import { contactHref } from "@/data/orgContact";
import LockedCard from "@/pages/event/LockedCard";

export default function ClimbOfficers({ climb, currentUser, setShowSignInModal }) {
  return (
    <>
      {/* Climb Officers */}
      <div className="section-card">
        <div className="section-header">
          <span className="icon">
            <Icon name="users" size={17} />
          </span>
          <h3>Climb Officers</h3>
        </div>
        <div className="section-body">
          {!currentUser ? (
            <>
              <LockedCard
                label="Sign in to view the climb officers"
                onUnlock={() => setShowSignInModal(true)}
              />
              <p
                className="tbd-note"
                style={{ marginTop: 12, marginBottom: 0 }}
              >
                Questions about this climb?{" "}
                {contactHref(`Question about ${climb.title}`) ? (
                  <a href={contactHref(`Question about ${climb.title}`)}>
                    Contact MMS Open Climbs
                  </a>
                ) : (
                  "Contact your MMS Open Climbs Coordinator."
                )}
              </p>
            </>
          ) : climb.officers?.length > 0 ? (
            climb.officers.map((o, i) => (
              <div className="officer-row" key={i}>
                <div>
                  <div className="officer-name">{o.name}</div>
                  <div className="officer-role">{o.role}</div>
                </div>
                <div className="officer-contact">{o.contact}</div>
              </div>
            ))
          ) : (
            <p className="tbd-note">
              Climb officers will be announced closer to the event date.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
