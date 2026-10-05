import DonationPledgeFields from "@/components/DonationPledgeFields";
import { isDonationDriveOn, stillNeededFromTotals } from "@/utils/donations";

export default function DonationPledgeSection({ climb, pledge, setPledge }) {
  return (
    <>
      {isDonationDriveOn(climb) && (
        <div className="register-form-card">
          <div className="form-section-title">Donation Pledge (Optional)</div>
          <p className="form-hint">
            This climb supports <strong>{climb.donationDrive.beneficiary}</strong>.
            {climb.donationDrive.description ? ` ${climb.donationDrive.description}` : ""}
          </p>
          <DonationPledgeFields
            drive={climb.donationDrive}
            value={pledge}
            onChange={setPledge}
            stillNeeded={stillNeededFromTotals(climb)}
          />
        </div>
      )}
    </>
  );
}
