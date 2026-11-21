import { getGuestAge, getGuests } from "@/utils/guests";

// Beside a registrant's name: "+2 guests" (hover lists them with their ages)
// and the Member / Joiner badge.
export default function ParticipantBadges({ reg, climb }) {
  const guests = getGuests(reg);
  const isMember = reg.memberType === "member";
  const title = guests.map((g) => `${g.name} (${getGuestAge(g, climb) ?? "?"})`).join(", ");
  return (
    <>
      {guests.length > 0 && (
        <span className="registrant-guests" title={title}>
          +{guests.length} guest{guests.length === 1 ? "" : "s"}
        </span>
      )}
      {reg.memberType && (
        <span className={`registrant-type ${isMember ? "registrant-type-member" : ""}`}>
          {isMember ? "Member" : "Joiner"}
        </span>
      )}
    </>
  );
}
