import { getEffectiveStatus } from "@/utils/climbStatus";
import { isClimbCompleted } from "@/utils/climbGrouping";

// How full a climb is, for the slot counter and bar.
export function getSlotSummary(climb) {
  const taken = climb.registrationCount ?? 0;
  const seatsLeft = climb.maxParticipants - taken;
  const fillPct = climb.maxParticipants ? Math.min(100, (taken / climb.maxParticipants) * 100) : 0;
  return {
    seatsLeft,
    isFull: seatsLeft <= 0,
    fillPct,
    fillClass: fillPct >= 100 ? "full" : fillPct >= 80 ? "low" : "ok",
  };
}

// "N slots remaining" only means something while the climb can still fill.
export const stillTakingPlaces = (climb) =>
  getEffectiveStatus(climb) !== "cancelled" && !isClimbCompleted(climb);
