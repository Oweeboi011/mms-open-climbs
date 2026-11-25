import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { updateRegistration } from "@/services/registrations";
import { logAuditEvent } from "@/services/auditLog";
import { getGuests, getHeadcount } from "@/utils/guests";
import { getTransportRiders, groupRidersByPickup } from "@/utils/climbers";

const PAY_LABEL = { paid: "paid", partial: "partly paid", unpaid: "not paid" };
const people = (riders) =>
  riders.reduce((n, r) => n + getHeadcount(r.reg), 0);

// Everyone taking the organized transport, with the pickup point each is
// assigned — set it right here rather than opening every participant.
export default function TransportRosterCard({
  regs,
  climb,
  serviceGroups = {},
}) {
  const { currentUser } = useAuth();
  const [error, setError] = useState("");
  const riders = getTransportRiders(regs, climb, serviceGroups);
  if (riders.length === 0) return null;
  const points = climb?.pickupPoints || [];
  const { groups, unset } = groupRidersByPickup(riders, climb);
  const ordered = [...groups.flatMap((g) => g.riders), ...unset];

  async function assign(reg, pickupPoint) {
    setError("");
    try {
      await updateRegistration(reg.id, { pickupPoint });
      logAuditEvent({
        actorUid: currentUser?.uid,
        actorName: currentUser?.displayName || currentUser?.email,
        action: "registration_edited",
        targetType: "registration",
        targetId: reg.id,
        targetLabel: reg.name || reg.id,
        details: `Set pickup point for ${climb?.title || "climb"}: ${pickupPoint || "not set"}`,
      });
    } catch {
      setError(`Could not save the pickup point for ${reg.name}.`);
    }
  }

  return (
    <div className="admin-card climbers-card">
      <div className="admin-card-title">
        Transportation &amp; Pickup Points — {people(riders)} people
      </div>
      {points.length === 0 ? (
        <p className="climbers-note">
          Add the pickup points (e.g. Baguio, Buendia, Cubao) under
          &quot;Transportation Pickup Points&quot; in the climb form, then
          assign each rider here.
        </p>
      ) : (
        <p className="climbers-note">
          {groups.map((g) => `${g.name}: ${people(g.riders)}`).join(" · ")}
          {unset.length > 0 && ` · Not set: ${people(unset)}`}. Counts include
          guests.
        </p>
      )}
      {error && <div className="form-error-msg">{error}</div>}
      <div className="transport-table-wrap">
        <table className="transport-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Pickup point</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map(({ reg, payStatus }) => {
              const guests = getGuests(reg);
              return (
                <tr key={reg.id}>
                  <td>
                    {reg.name}
                    {guests.length > 0 && (
                      <div className="climbers-guest">
                        + {guests.map((g) => g.name).join(", ")}
                      </div>
                    )}
                  </td>
                  <td>
                    {points.length > 0 ? (
                      <select
                        className="form-select"
                        aria-label={`Pickup point for ${reg.name}`}
                        value={reg.pickupPoint || ""}
                        onChange={(e) => assign(reg, e.target.value)}
                      >
                        <option value="">Not set</option>
                        {points.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{PAY_LABEL[payStatus]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
