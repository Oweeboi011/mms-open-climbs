import { useEffect, useState } from "react";
import { getClimb, getClimbPrivate } from "@/services/climbs";
import { listRegistrationsForClimb } from "@/services/registrations";
import { readClimbPrivate } from "@/utils/registrationFees";

// A climb with its registrations and service-sharing groups, loaded once
// (not live) so a printed sheet matches what was on screen.
export default function useClimbRoster(climbId) {
  const [climb, setClimb] = useState(null);
  const [regs, setRegs] = useState([]);
  const [serviceGroups, setServiceGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [climbDoc, priv, roster] = await Promise.all([
          getClimb(climbId),
          getClimbPrivate(climbId),
          listRegistrationsForClimb(climbId),
        ]);
        setClimb(climbDoc);
        if (priv) setServiceGroups(readClimbPrivate(priv).serviceGroups || {});
        setRegs(roster);
      } catch (err) {
        setError(err?.message || "Could not load the climb.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [climbId]);

  return { climb, regs, setRegs, serviceGroups, loading, error };
}
