import { useEffect, useState } from "react";
import { subscribeToAllClimbPrivate, subscribeToEveryClimb } from "@/services/climbs";
import { subscribeToRegistrationsNewestFirst } from "@/services/registrations";
import { compareStartDate } from "@/utils/climbGrouping";
import { readClimbPrivate } from "@/utils/registrationFees";

// Every climb (earliest first), its sharing groups and every registration
// (newest first), live — fee schedules and groups edited elsewhere must land in the admin
// money views without a reload. One listener per collection, not per climb.
export default function useLiveClimbData() {
  const [climbs, setClimbs] = useState([]);
  const [climbPrivateMap, setClimbPrivateMap] = useState({});
  const [regs, setRegs] = useState(null);

  useEffect(() => {
    const unsubClimbs = subscribeToEveryClimb((docs) => setClimbs([...docs].sort(compareStartDate)));
    const unsubPrivate = subscribeToAllClimbPrivate((docs) => {
      const map = {};
      docs.forEach(({ id, ...data }) => {
        map[id] = readClimbPrivate(data);
      });
      setClimbPrivateMap(map);
    });
    const unsubRegs = subscribeToRegistrationsNewestFirst(setRegs, () => setRegs([]));
    return () => {
      unsubClimbs();
      unsubPrivate();
      unsubRegs();
    };
  }, []);

  return { climbs, setClimbs, climbPrivateMap, regs: regs ?? [], loading: regs === null };
}
