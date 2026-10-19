// The in-app runbook (/help). Steps are short, in order, and name the exact
// buttons members see; **text** renders bold. `adminOnly` sections show only
// to admins. Keep in step with docs/guides/USER_MANUAL.md.
export const HELP_GUIDES = [
  {
    id: "getting-started",
    title: "Getting started",
    intro: "You can browse climbs without an account. You need one to register.",
    steps: [
      "Open **mms-open-climbs.web.app** in Chrome or Safari. If you tapped a link inside Facebook or Messenger, tap **Open in Browser** first: Google sign-in doesn't work inside those apps.",
      "Tap **Create Account**. Sign up with your email and a password, or tap **Continue with Google**.",
      "Signed up with email? Open the verification email and tap its link. Check your spam folder if it isn't there.",
      "Forgot your password? On **Sign In**, tap **Forgot password?** (email accounts only; Google accounts use Google's password).",
    ],
  },
  {
    id: "joining",
    title: "Joining a climb",
    steps: [
      "On **Schedule**, tap a climb's card. Read its fees, requirements and things to bring.",
      "Tap **Register Now**. If it says **Join the Waitlist**, the climb is full and you'll be told if a slot opens.",
      "Check your details. After your first climb they're filled in from **My Details**: make sure they're still right.",
      "Choose your **Participant Type**: **MMS Member** or **Joiner**. Joiners pay the climb's Guest Fee, if it has one.",
      "Tick any optional fees you want, such as transportation. The total updates as you go.",
      "Upload any required documents now, or later from **My Climbs**.",
      "Pay now, pay part, or pay later (see Paying with GCash).",
      "Read the **Waiver** and **Privacy Notice**, tick both, type your full name as your signature, and submit. Your registration is now **Pending**.",
    ],
  },
  {
    id: "paying",
    title: "Paying with GCash",
    steps: [
      "Tap the climb's QR code to enlarge it and scan it in GCash, or send to the GCash number and name shown.",
      "Put **your full name** as the reference so the officers can match your payment.",
      "Enter the **exact amount** you sent and upload your receipt (a screenshot or PDF).",
      "Paying the rest later or adding a fee? Go to **My Climbs** and tap **Submit Payment** or **Add Fees / Pay More** on the climb's card.",
      "Each payment is checked and marked **Verified** or **Rejected**. The bell tells you, and your card shows your remaining balance.",
    ],
  },
  {
    id: "after",
    title: "After you register",
    steps: [
      "**My Climbs** shows each climb's status, your balance and every payment's verdict.",
      "The officers confirm you once everything checks out: your status changes from **Pending** to **Confirmed**.",
      "The bell reminds you about an unpaid balance, missing documents, an unsigned waiver, and the days before your climb.",
      "Added to a climb by an officer? Sign your waiver: **My Climbs → Sign Waiver** on that climb's card.",
      "Changed your mobile number or emergency contact? Tap **Update Details** on the climb's card. For future climbs, update **My Details** (tap your name at the top of the page).",
      "Can't go? Tap **Cancel Registration** on the card. If you've paid, the officers will contact you about a refund under the climb's cancellation policy.",
      "After the climb, tap **Leave Feedback** to rate it.",
    ],
  },
  {
    id: "officers",
    title: "For climb officers",
    steps: [
      "Climbs you help run appear on **My Climbs** under **Assigned as Officer**.",
      "You're emailed when someone registers or a registration's status changes, and get a daily summary while anyone owes payment or documents.",
      "Reviewing payments and confirming participants needs the admin role. If you don't have it, ask an MMS admin to grant it or to review for you.",
    ],
  },
  {
    id: "admins",
    title: "For admins",
    adminOnly: true,
    steps: [
      "Open a climb's registrants: **Admin → Manage Climbs**, then tap the climb's name. On a climb's event page you can also use **Registrants** or **Edit Climb**.",
      "Review a payment: expand the registrant, check the receipt against GCash (same amount, their name as reference), then tap **✓** to verify or **✕** to reject. **Reset to Submitted** undoes it; **Split Payment** moves one person's payment onto others; **Record Refund** logs money sent back.",
      "Confirm participants with **✓ Confirm**, or move them to the waitlist or cancel them.",
      "The **Compliance** column shows only what's missing. Hover it for the full checklist.",
      "Documents: **Manage Documents** uploads a file on someone's behalf. No file? Tick **Received without a file** and note how you saw it.",
      "Waivers are signed by the participant. If they gave a paper waiver, use **Mark received offline** with a note: it never shows as a typed signature.",
      "Walk-ins: **Add Participant**. Picking an existing member fills in their saved details.",
      "Money at a glance: the stats tiles (Verified and Unverified Payments, Total Outstanding), then **Remaining Balances**, **Fully Paid** and **Excess Payments**.",
      "Who still owes across every climb: **Manage Registrations**, filter **Has Balance Due**, and **Export CSV**.",
      "On climb day, open the **Climb-Day Sheet** for the roster, contacts and emergency details, and mark anyone who didn't come as a **No-show**.",
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    steps: [
      "**Google sign-in does nothing:** you're inside an app's browser (Facebook, Messenger, Instagram). Tap **Open in Browser**, or copy the link into Chrome or Safari.",
      "**No verification or reset email:** check spam or junk, wait a few minutes, and make sure the email address is right.",
      "**Taken to My Climbs when you tap Register:** you're already registered for that climb. Use your existing registration.",
      "**No Register button:** registration is closed, on hold, or the climb was cancelled. The event page says which.",
      "**Receipt won't upload:** use a JPG, PNG or PDF and wait for the upload to finish.",
    ],
  },
];
