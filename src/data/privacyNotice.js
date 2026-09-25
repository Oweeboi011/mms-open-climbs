// The privacy notice members agree to when registering. Bump the version
// whenever the substance changes: each registration records the version it
// was given, so the club can show what a member actually consented to.
export const PRIVACY_NOTICE_VERSION = "2026-09-26";

export const PRIVACY_NOTICE_SECTIONS = [
  {
    heading: "Who we are",
    body:
      "MMS Open Climbs is run by the Metropolitan Mountaineering Society (MMS) " +
      "to organise its open climbs. This notice explains what personal " +
      "information the portal collects, why, and how it is protected, in line " +
      "with the Data Privacy Act of 2012 (Republic Act No. 10173).",
  },
  {
    heading: "What we collect",
    items: [
      "Account details: your name and email address.",
      "Registration details: mobile number, date of birth, address, experience level and member/joiner type.",
      "Safety details: your emergency contact (name, mobile, relationship) and any medical conditions you declare.",
      "Documents you upload when a climb requires them: registration form, medical certificate, permit and signed waiver.",
      "Payment records: amounts, GCash receipts you upload, and their review status. We never see or store your GCash login or card details.",
      "Your typed waiver signature, and optional donation pledges.",
      "Basic usage data: pages visited and errors, used to keep the site working. It is deleted after 90 days.",
      "Anti-abuse checks: Google reCAPTCHA looks at how your browser interacts with the site to confirm requests come from a real visitor. Google's Privacy Policy (policies.google.com/privacy) and Terms (policies.google.com/terms) apply.",
    ],
  },
  {
    heading: "Why we collect it",
    items: [
      "To register you for a climb, confirm your slot and keep in touch about it.",
      "For your safety on the trail: climb officers use your emergency contact and medical information if something goes wrong.",
      "To secure permits and meet the requirements of the mountain's managing office.",
      "To record and verify payments, refunds and donations.",
    ],
  },
  {
    heading: "Who can see it",
    body:
      "Only MMS portal administrators can see your details, documents and " +
      "payments in the portal. The officers leading your climb are emailed your " +
      "name and email when you register, and are given your emergency and " +
      "medical details for use on the trail. Other members cannot see them; " +
      "your name may appear on the climb's participant list. We do not sell or share your " +
      "information with anyone else, except where a permit office or the law " +
      "requires it, or in an emergency on the trail.",
  },
  {
    heading: "Where it is stored",
    body:
      "On Google Firebase (Google Cloud), with access limited by security rules " +
      "to you and the administrators. Emails are sent " +
      "through Brevo.",
  },
  {
    heading: "How long we keep it",
    body:
      "Registration records are kept as the club's attendance and payment " +
      "history. Uploaded documents and receipts are deleted two years after " +
      "upload. If your account is deleted, your health and contact details are " +
      "removed from your registrations and your uploaded files are deleted.",
  },
  {
    heading: "Your rights",
    body:
      "You may ask to see, correct or delete your personal information, or " +
      "withdraw your consent, by contacting the club. You can correct your " +
      "contact and medical details yourself from My Climbs. Withdrawing consent " +
      "may mean we can no longer register you for climbs.",
  },
];
