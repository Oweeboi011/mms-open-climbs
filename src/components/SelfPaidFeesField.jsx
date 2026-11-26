import FeeUnitChecklist from "@/components/FeeUnitChecklist";
import { guestFeeUnits } from "@/utils/climbers";

// Admin: fees this registration's party pays directly (to the venue or
// locals) instead of through the org. They still take part, so they stay in
// the lists, but the amount isn't owed to the org.
export default function SelfPaidFeesField({ climb, value, onChange }) {
  return (
    <FeeUnitChecklist
      legend="Pays on their own (not through the org)"
      units={guestFeeUnits(climb, { shareable: true })}
      value={value}
      onChange={onChange}
    />
  );
}
