/**
 * MMS Open Climbs 2026 — Standard Liability Waiver
 * Displayed during registration and printed from the waiver page.
 */
export default function WaiverText({ climbTitle, climbDate, climbLocation }) {
  const eventDesc = [climbTitle, climbDate, climbLocation].filter(Boolean).join(' · ');

  return (
    <>
      <h4>Activity Description</h4>
      <p>
        This waiver pertains to participation in <strong>{eventDesc || 'the MMS Open Climb activity'}</strong>,
        organised by the Metropolitan Mountaineering Society (MMS) as part of the Open Climbs 2026 programme.
      </p>

      <h4>Acknowledgment of Risk</h4>
      <p>
        I understand and acknowledge that mountaineering, trekking, and outdoor activities involve inherent
        risks including but not limited to: physical exhaustion, altitude sickness, extreme weather, falls,
        injuries from terrain or wildlife, and in extreme cases, death. I voluntarily accept these risks
        as a condition of my participation.
      </p>

      <h4>Waiver and Release of Liability</h4>
      <p>
        In consideration of being permitted to participate in the Activity, I hereby fully, irrevocably,
        and unconditionally release and discharge MMS, its Board of Directors, officers, members,
        coordinators, guides, volunteers, and agents from any and all liability, claims, demands, actions,
        and causes of action arising out of or related to any loss, damage, illness, injury, or death
        that may be sustained by me while participating in the Activity or travelling to and from the
        Activity venue, whether caused by negligence of MMS or otherwise.
      </p>

      <h4>Assumption of Risk</h4>
      <p>
        I confirm that I am participating voluntarily and of my own free will. I have assessed my
        physical condition and believe I am fit to participate. I understand that MMS cannot guarantee
        my safety and that I assume all risks associated with the Activity.
      </p>

      <h4>Emergency Medical Authorization</h4>
      <p>
        I authorise MMS and its representatives to seek, obtain, and consent to emergency medical
        treatment on my behalf if I am incapacitated and unable to provide consent. I agree to bear
        all costs associated with any such treatment.
      </p>

      <h4>Physical Fitness Declaration</h4>
      <p>
        I declare that I am in good physical and mental health and that no medical condition, disability,
        or medication prevents my safe participation in this Activity. Any known medical conditions or
        allergies have been disclosed in my registration form.
      </p>

      <h4>Leave No Trace</h4>
      <p>
        I agree to strictly observe the 7 Leave No Trace principles, all rules and regulations set by
        MMS, the Department of Environment and Natural Resources (DENR), local government units, and
        protected area management offices applicable to the Activity.
      </p>

      <h4>Media Release</h4>
      <p>
        I grant MMS the right to use photographs, videos, or other recordings made of me during the
        Activity for organisational, promotional, or educational purposes, without compensation.
      </p>

      <h4>Governing Law</h4>
      <p>
        This waiver shall be governed by the laws of the Republic of the Philippines. If any provision
        is held unenforceable, the remaining provisions shall continue in full force. This document
        constitutes the entire agreement between the parties regarding its subject matter and supersedes
        any prior agreements.
      </p>
    </>
  );
}
