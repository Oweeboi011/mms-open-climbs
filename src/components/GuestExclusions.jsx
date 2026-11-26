import FeeUnitChecklist from "@/components/FeeUnitChecklist";
import { guestFeeUnits } from "@/utils/climbers";

// Admin: what a guest does not take part in. Ticked items come off the
// member's bill and the guest drops out of that trail or the van.
export default function GuestExclusions({ guest, index, climb, onChange }) {
  return (
    <FeeUnitChecklist
      legend={`Guest ${index + 1} doesn't take part in`}
      units={guestFeeUnits(climb)}
      value={guest.excludedFees || []}
      onChange={onChange}
    />
  );
}
