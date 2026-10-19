// The in-app runbook (/help). Each guide is a task, its steps in order, and
// names the exact buttons in the app; **text** renders bold. A step can be a
// string or { text, details: [...] } for sub-steps. `group` sets where it
// sits in the contents; `adminOnly` guides show only to admins.
// Keep in step with docs/guides/USER_MANUAL.md.
export const HELP_GROUPS = ["Everyone", "Members", "Climb officers", "Admins", "Reference"];

export const HELP_GUIDES = [
  // ── Everyone ───────────────────────────────────────────────────────────
  {
    id: "browsing",
    group: "Everyone",
    title: "Browsing the climb schedule",
    intro: "No account needed to browse. The schedule shows one season (year) at a time.",
    steps: [
      "Open **mms-open-climbs.web.app** in Chrome, Safari, Edge or Firefox, on a phone, tablet or computer. Nothing to install.",
      {
        text: "On **Schedule**, each card shows a climb at a glance:",
        details: [
          "Name and date",
          "Summit elevation, difficulty rating and trip distance",
          "Type: **Minor**, **Major** or **Special**",
          "Its Team Leader and Assistant Team Leader (or “No Officers Yet”)",
        ],
      },
      "Use the season tabs to switch years; the current season opens first.",
      "Filter by type with **All**, **Minor**, **Major** or **Special** (the stat tiles at the top filter the same way), or jump to a month with the month buttons.",
      "Tap a card to open the climb’s event page.",
    ],
  },
  {
    id: "event-page",
    group: "Everyone",
    title: "Reading a climb’s event page",
    steps: [
      {
        text: "Everyone can see:",
        details: [
          "**Mountain profile**: elevation, difficulty, trail class, jump-off point, elevation gain, distances and trail features",
          "**Photos**: tap one for a full-screen viewer",
          "**Weather & Forecast**: appears within 16 days of the climb, for the climb’s Philippine dates; it shows the forecast area it uses",
          "**Fees**, including optional fees and the Guest Fee for joiners",
          "**Requirements**: documents the climb needs, e.g. medical certificate or permit",
          "**Things to Bring**, **Leave No Trace**, and water sources where given",
          "**Outreach & Donations**, when the climb runs a donation drive",
          "**Announcements** from the organizers",
        ],
      },
      "Signed in, you also see the **Itinerary**, **Trail Map**, **Climb Officers** with their contact details, and how many have joined.",
      "Registered for the climb, you also see who’s joining, **Pre-climb meetings** (date, place, link, recording) and **Climb Resources**.",
      {
        text: "The button near the top tells you where registration stands:",
        details: [
          "**Register Now**: open for registration",
          "**Join the Waitlist**: full; you’ll be added to the waitlist",
          "A note when registration is closed, on hold (postponed) or the climb was cancelled",
          "Your own status if you’re already registered",
          "Signed out: **Sign In to Register** or **Create a free account**",
        ],
      },
    ],
  },
  {
    id: "account",
    group: "Everyone",
    title: "Creating an account and signing in",
    intro: "You need a free account to register for a climb.",
    steps: [
      "Use a real browser. If you tapped a link inside Facebook, Messenger or Instagram, tap **Open in Browser** first: Google sign-in doesn’t work inside those apps.",
      {
        text: "Tap **Create Account** (or **Create a free account** on a climb), then either:",
        details: [
          "Enter your **Full Name**, **Email**, **Password** and **Confirm Password**, then tap **Create Account**, or",
          "Tap **Continue with Google** and choose your Google account.",
        ],
      },
      "Signed up with email? Open the verification email and tap its link. Until you do, a banner reminds you and offers **Resend email**. Check spam or junk if it isn’t in your inbox.",
      "If you started from a climb’s Register button, you’re taken straight back to its registration form.",
      "To sign in later, tap **Sign In** and use the same email and password, or **Continue with Google**.",
      {
        text: "Forgot your password (email accounts only)?",
        details: [
          "On **Sign In**, tap **Forgot password?**",
          "Enter your account’s email and tap **Send Reset Link**",
          "Open the email (check spam) and set a new password",
          "Google accounts use your Google password; reset it with Google",
        ],
      },
      "The first time you sign in, a short welcome guide walks you through the app. Reopen it any time with the guide icon in the header.",
    ],
  },

  // ── Members ────────────────────────────────────────────────────────────
  {
    id: "registering",
    group: "Members",
    title: "Registering for a climb",
    intro: "One active registration per climb. The form keeps everything on one page; anything missing is listed at the top when you submit.",
    steps: [
      "Sign in, open the climb’s event page and tap **Register Now** (or **Join the Waitlist** if it’s full).",
      "Already registered? You’re taken to **My Climbs** instead.",
      {
        text: "Personal information. After your first climb these are filled in from **My Details**, with a note saying which climb they came from: check they’re still right.",
        details: [
          "**Full Name** (required)",
          "**Mobile Number** (required), as +63 9XX XXX XXXX",
          "**Date of Birth** and **Address** (City, Province is enough), optional",
          "**Experience Level** (required): Beginner (0–5 climbs), Intermediate (5–20) or Experienced (20+)",
          "**Participant Type** (required): **MMS Member** or **Joiner**",
        ],
      },
      "**Emergency contact** (required): their name, mobile and your relationship to them (e.g. Parent, Spouse, Sibling).",
      "**Medical information** (optional): conditions, allergies or medicines relevant outdoors. Only the climb’s officers and admins see it, for emergencies. Leave it blank if you have none.",
      "**Required documents**: upload any the climb asks for (PDF, Word or an image) now, or later from **My Climbs**. They don’t block registration.",
      {
        text: "**Fee breakdown**:",
        details: [
          "Required fees are included automatically",
          "Tick the optional fees you’ll avail, e.g. transportation",
          "Joiners pay the Guest Fee, if the climb has one; MMS Members never do",
          "The total updates as you tick; organizers may correct a fee later and My Climbs always shows the current amount",
        ],
      },
      "**Payment** (optional now): pay all, part or nothing. If you enter an amount you must attach the receipt, and the other way round. See Paying with GCash.",
      "**Donation pledge** (optional, when the climb runs a drive): pledge cash or items, and choose whether a cash pledge is paid with your fees.",
      "Read the **Waiver & Release of Liability** and tick to agree, agree to the **Privacy Notice**, and type your full legal name as your **Digital Signature** (at least 3 characters).",
      "Check the summary of your fees and payment, then submit. You’ll see your registration is **Pending**, get a confirmation email, and a reminder if you still owe payment or documents.",
    ],
  },
  {
    id: "paying",
    group: "Members",
    title: "Paying with GCash",
    intro: "Each climb has its own GCash QR code and account. You can pay in batches.",
    steps: [
      "In **Payment via GCash** (on the registration form, or **Submit Payment** on My Climbs), tap the QR code to enlarge it.",
      "Scan it in your GCash app, or send to the **GCash Number** and **Account Name** shown.",
      "Put **your full name** as the payment reference so the organizers can match it.",
      "Enter the **exact amount** you sent; it must match your receipt.",
      "Upload the receipt: a screenshot, photo or PDF. You can attach more than one file.",
      "Add **Payment Notes** for the officers if needed.",
      {
        text: "After you submit:",
        details: [
          "Each payment is reviewed on its own and marked **Verified** or **Rejected**; the bell tells you",
          "Your card on My Climbs shows a **Payment Log** with every payment and its verdict, and your remaining balance",
          "Pay the rest, or add an optional fee later, with **Submit Payment** or **Add Fees / Pay More** on the card",
          "If the climb has a payment due date, the card shows **Due by …** or **Overdue**",
          "**View OR** shows the receipts you submitted",
        ],
      },
    ],
  },
  {
    id: "my-climbs",
    group: "Members",
    title: "Using My Climbs",
    intro: "Tap **My Climbs** in the header to see every climb you’ve registered for.",
    steps: [
      "The tiles at the top count **Climbs Completed**, **Upcoming Climbs**, climbs you help run, **Unpaid Climbs** and cancelled climbs.",
      "Climbs are split into **Upcoming Climbs** (soonest first) and **Past Climbs**. A climb counts as past once its last day has ended.",
      "Each card shows your status (**Pending**, **Confirmed**, **Waitlisted** or **Cancelled**), payment status and balance, the Payment Log, your fees and your submitted details.",
      {
        text: "Buttons on a card (each shows only when it applies):",
        details: [
          "**View Climb**: the event page",
          "**Sign Waiver**: if an officer added you and you haven’t signed yet",
          "**Print Waiver**: once signed",
          "**Complete Your Details** / **Update Details**: your mobile, emergency contact and medical information for this climb",
          "**Submit Payment** / **Add Fees / Pay More**: pay a balance or add an optional fee",
          "**View OR**: the receipts you submitted",
          "**Submit Required Documents** / **View Submitted Documents**",
          "**Pledge a Donation** / **Edit Donation Pledge**, when the climb runs a drive",
          "**Cancel Registration**: while pending, confirmed or waitlisted, before the climb",
          "**Leave Feedback**: after a climb you attended as a confirmed participant (once)",
        ],
      },
      "No registrations yet? Tap **Browse Climbs**.",
    ],
  },
  {
    id: "waiver",
    group: "Members",
    title: "Signing and printing your waiver",
    steps: [
      "You sign the waiver when you register: tick the agreement and type your full legal name.",
      "If an officer added you to a climb, you sign it yourself: on **My Climbs**, tap **Sign Waiver** on that climb’s card. Your name is filled in; read, tick and confirm. The bell reminds you every day until you do.",
      "Only you can sign your waiver. If you gave the organizers a paper waiver instead, they can record it, and your card shows **Waiver received by the organizers (offline)**.",
      "To print or save it, tap **Print Waiver** on the card, then use your browser’s print (Ctrl+P or Cmd+P) to print or save as PDF. It includes the waiver, your registration details and your typed signature with its date and time.",
    ],
  },
  {
    id: "documents",
    group: "Members",
    title: "Submitting required documents",
    steps: [
      "Some climbs need documents: a registration form, medical certificate, permit or a waiver document. The event page lists them under **Requirements**, and may offer a template to download.",
      "Upload them on the registration form, or later with **Submit Required Documents** on the climb’s card in My Climbs. PDF, Word or an image all work.",
      "**View Submitted Documents** shows what you’ve sent. The bell reminds you about anything still missing.",
      "If you showed a document in person instead, the organizers can mark it received; it then shows as received offline.",
    ],
  },
  {
    id: "my-details",
    group: "Members",
    title: "Keeping My Details up to date",
    intro: "My Details fills in your next registration, so you don’t retype everything for every climb.",
    steps: [
      "Open it by tapping your name at the top of the page, or **My Details** under the title on My Climbs.",
      "It holds your mobile, date of birth, address, experience level, participant type, emergency contact and medical information.",
      "It updates itself from each registration you submit or update. You can also change it any time and tap **Save My Details**.",
      "Changes here apply to future registrations. To fix a climb you’re already registered for, use **Update Details** on its card in My Climbs.",
      "Only you and the club’s admins can see it. It’s deleted if your account is deleted.",
    ],
  },
  {
    id: "notifications",
    group: "Members",
    title: "Notifications (the bell)",
    steps: [
      "The bell at the top shows how many notifications you haven’t read. Tap one to jump to the right page, or **Mark all read**.",
      {
        text: "You’ll hear about:",
        details: [
          "An unpaid balance, missing documents or an unsigned waiver (repeated daily until done)",
          "Your registration being confirmed, waitlisted or cancelled, and a waitlist slot opening",
          "Each payment being verified or rejected, and refunds",
          "Your climb coming up: 7, 5, 3 and 1 days before",
          "Climb announcements, and a climb being cancelled or postponed",
          "A feedback request after the climb",
        ],
      },
      "Some of these are also emailed: your registration confirmation, status changes, cancellations and postponements, and a thank-you after the climb.",
    ],
  },
  {
    id: "cancelling",
    group: "Members",
    title: "Waitlists, cancelling and refunds",
    steps: [
      "Full climb? **Join the Waitlist**. When a slot opens, the earliest waitlisted registration moves up (automatically, or by the officers, depending on the climb) and you’re notified. Then settle your fees and documents so the officers can confirm you.",
      "Can’t go? Tap **Cancel Registration** on the card, any time before the climb. Only an admin can undo a cancellation.",
      "If you’ve paid, the organizers contact you about a refund under the climb’s cancellation policy. Refunds show on your card and the bell tells you.",
      "If the organizers cancel or postpone a climb, every registrant is emailed with the reason.",
    ],
  },
  {
    id: "after-climb",
    group: "Members",
    title: "After the climb",
    steps: [
      "Confirmed participants get a thank-you email and a feedback request.",
      "Tap **Leave Feedback** on the climb’s card to give a star rating and optional comments (once).",
      "**What’s New** in the header lists every update to the app.",
    ],
  },

  // ── Climb officers ──────────────────────────────────────────────────────
  {
    id: "officers",
    group: "Climb officers",
    title: "For climb officers",
    steps: [
      "Climbs you help run appear on **My Climbs** under **Assigned as Officer**, with your role (e.g. Team Leader). **View Climb** opens the event page.",
      "You’re emailed when someone registers or a registration’s status changes.",
      "While a climb you run still has unpaid balances or missing documents, you get a daily summary in the bell and by email.",
      "Reviewing payments and confirming participants needs the admin role. Without it, ask an MMS admin to grant it or to review for you. With it, see the admin guides below.",
    ],
  },

  // ── Admins ──────────────────────────────────────────────────────────────
  {
    id: "admin-climbs",
    group: "Admins",
    adminOnly: true,
    title: "Setting up and managing climbs",
    steps: [
      "Open **Admin** in the header, then **Manage Climbs**. Tap **+ New Climb** to create one.",
      "On the list, tap a climb’s name to open its registrants, the ↗ to open its public page, or **Edit** to change it. On a climb’s event page, admins also get **Registrants** and **Edit Climb**.",
      "Each row shows what still needs attention: payments to review, money due, required documents, and a ⚠ count of set-up gaps (hover it). Expand a row for the **Completeness Check**, fee schedule and remaining balances.",
      "**Change Status** moves a climb through Draft → Open ⇄ Closed → Completed, or Cancelled.",
      {
        text: "The climb form covers:",
        details: [
          "Basic info, mountain profile, itinerary, trail photos and trail maps (Google Maps, AllTrails, Komoot)",
          "**Fees**: each can be optional, a **Guest Fee** (joiners only) or shareable (split among members, see Service Sharing)",
          "GCash account name, number and QR code",
          "Climb officers: link each to their member account so the climb shows on their My Climbs",
          "Required documents and their templates",
          "Pre-climb meetings, resources for registrants, and announcements (announcements notify registrants)",
          "Payment due date, cancellation policy, things to bring, donation drive, and whether the waitlist promotes automatically",
          "Cancelling or postponing, with a reason: every registrant and officer is emailed",
        ],
      },
    ],
  },
  {
    id: "admin-registrants",
    group: "Admins",
    adminOnly: true,
    title: "Running a climb’s registrant list",
    steps: [
      {
        text: "The stats row at the top counts:",
        details: [
          "Total registrations, then **Members** and **Guests** (active registrations)",
          "Confirmed, Pending, Waitlisted, Cancelled and Awaiting Payment Review",
          "**Verified Payments** and **Unverified Payments**: amounts and how many payments",
          "Total Outstanding, Open Slots, No-shows and Required Docs In",
        ],
      },
      "Search by name or email, and filter by status, payment (e.g. **Has Outstanding Balance**) and compliance (**Missing Anything**, **Missing Waiver**, **Missing Details** or a specific document).",
      "Each row shows the participant, what’s missing (hover the Compliance column for the full checklist), payment status, balance and registration status. Tap a row to expand it.",
      {
        text: "In the expanded row:",
        details: [
          "**✎ Edit** their details, **✓ Confirm**, **Waitlist** or **✕ Cancel** the registration",
          "Their details, emergency contact and medical information, and optional services",
          "The waiver: signed, received offline, or **Mark received offline** (see Waivers and documents)",
          "Payments and receipts (see Reviewing payments)",
          "**+ Manage Documents** for required documents",
          "**+ Add Note** / **Edit Note** for a private admin note",
          "**Mark no-show** / **Undo no-show** after the climb",
        ],
      },
      "**+ Add Participant** adds a walk-in. Type their details, or pick an **existing member** so it shows on their My Climbs; their saved details fill in. They sign their own waiver.",
      "**Export CSV** downloads the list. **Donations** opens the donation drive page; **Climb-Day Sheet** opens the printable roster.",
    ],
  },
  {
    id: "admin-payments",
    group: "Admins",
    adminOnly: true,
    title: "Reviewing payments",
    steps: [
      "Open the climb’s registrants and expand someone with a submitted payment (filter **Payment Submitted** to find them all).",
      "Open the receipt and check it against GCash: the same amount, and their name as the reference.",
      "Verify or reject each payment on its own with ✓ or ✕ in the payment history, or all at once with **✓ Verify Payment** / **✕ Reject Payment**. The participant is notified either way.",
      "Marked the wrong one? **Reset to Submitted** puts it back for review.",
      "**+ Record Payment** logs cash or money received outside the app.",
      "One person paid for others? Use **Split** on that payment to move each person’s share onto their record (**Undo split** reverses it).",
      "Sent money back? **Record Refund** logs it; it comes off what they paid.",
      {
        text: "Money summaries on the registrant page:",
        details: [
          "**Remaining Balances**: who still owes, biggest first",
          "**Fully Paid**: who owes nothing",
          "**Excess Payments**: who paid more than they owe; split or refund it",
          "**Expenses** and **Where the Money Stands**: the climb’s costs against what was collected",
          "**Service Sharing**: group members sharing one unit of a shareable fee, e.g. a vehicle",
        ],
      },
      "Across every climb, **Admin → Manage Payments** shows each climb’s totals and its GCash details (**Edit Fees**, **Upload QR Code** / **Replace QR Code**).",
    ],
  },
  {
    id: "admin-paperwork",
    group: "Admins",
    adminOnly: true,
    title: "Waivers and documents",
    steps: [
      "A participant signs their own waiver; no one can sign for them. Someone you added through Add Participant signs from My Climbs, and the bell reminds them daily.",
      "If they gave a paper or in-person waiver, expand their row and tap **Mark received offline**, then note how (e.g. signed paper waiver at the jump-off) and save. It counts as done and shows as “Received offline” with your name and the date, never as a typed signature.",
      "Documents: **+ Manage Documents** uploads a file on their behalf, or replaces one.",
      "No file to upload? Tick **Received without a file** for that document and note how you saw it (e.g. shown at the jump-off). It then counts as submitted.",
      "Details missing? **✎ Edit** their mobile and emergency contact. Medical information is optional.",
    ],
  },
  {
    id: "admin-climb-day",
    group: "Admins",
    adminOnly: true,
    title: "Climb day",
    steps: [
      "Open the **Climb-Day Sheet** from the climb’s registrants: the roster, contacts, emergency details, medical notes, payment and waiver status. Print it or save it as PDF.",
      "After the climb, use **Mark no-show** on anyone confirmed who didn’t come.",
      "Record donations received on the **Donations** page; it updates the public totals.",
    ],
  },
  {
    id: "admin-registrations",
    group: "Admins",
    adminOnly: true,
    title: "Every registration, users and settings",
    steps: [
      "**Manage Registrations** lists every registration in one table. Filter by climb, status, payment (including **Has Balance Due**) and **Missing Required Docs**, then **Export CSV**.",
      {
        text: "**Users**:",
        details: [
          "Search users; **Add New User** creates an account and emails a password-setup link (**Create & Send Invite**)",
          "Open a user to **Edit Profile** (name and login email), **Change Role**, see their climb history, or **Delete account** (their registrations are kept without health and contact details)",
        ],
      },
      "**Release Notes**: write a note, or use **Generate from Git History** to draft one. Publish it, then **Preview & Send** to email members (needs the “email every member” permission).",
      "**Analytics** shows page views and the **Failed Requests** log; **App Insights** shows operational dashboards: registrations, payments, document compliance, email delivery, storage, functions and cost.",
    ],
  },

  // ── Reference ──────────────────────────────────────────────────────────
  {
    id: "faq",
    group: "Reference",
    title: "Frequently asked questions",
    steps: [
      "**Do I need an account to see climbs?** No. The schedule and event pages are open to everyone; the itinerary, trail map, officers and participants need you to sign in.",
      "**Can I register for the same climb twice?** No. With an active registration, you’re taken to My Climbs.",
      "**Do I have to pay when I register?** No. Pay all, part or none, and settle the rest from My Climbs.",
      "**What’s the difference between MMS Member and Joiner?** Joiners pay the Guest Fee, if the climb has one; members don’t.",
      "**How do I know my payment was received?** Your card on My Climbs shows each payment’s verdict and your balance, and the bell tells you when it’s verified or rejected.",
      "**Can I cancel myself?** Yes, with Cancel Registration before the climb. Confirming, waitlisting and reinstating are done by admins.",
      "**Who sees my medical information?** Only the climb’s officers and admins, for emergencies. It’s optional.",
    ],
  },
  {
    id: "troubleshooting",
    group: "Reference",
    title: "Troubleshooting",
    steps: [
      "**Google sign-in does nothing or errors:** you’re inside an app’s browser (Facebook, Messenger, Instagram). Tap **Open in Browser**, or open the link in Chrome, Safari or Edge.",
      "**No verification, confirmation or reset email:** check spam or junk, wait a few minutes, and check the email address is right.",
      "**“Registration failed” when submitting:** usually a network hiccup. Check your connection and try again.",
      "**Taken to My Climbs when you tap Register:** you’re already registered for that climb.",
      "**No Register button:** registration is closed, on hold or the climb was cancelled. The event page says which.",
      "**Receipt won’t upload:** use a JPG, PNG or PDF and wait for the upload to finish.",
      "**Signature not accepted:** type your full legal name, at least 3 characters.",
      "**Forecast says it can’t load:** the climb’s location couldn’t be matched to a place; organizers can add the town, e.g. “Kabayan, Benguet”.",
    ],
  },
  {
    id: "glossary",
    group: "Reference",
    title: "Glossary",
    steps: [
      "**Climb**: a scheduled event on the Schedule page. **Season**: one year’s climbs.",
      "**Minor / Major / Special**: climb types.",
      "**Joiner**: a non-member participant, who pays the Guest Fee.",
      "**Pending**: registered, awaiting confirmation. **Confirmed**: your slot is secured. **Waitlisted**: held until a slot opens. **Cancelled**: withdrawn or declined.",
      "**Payment status**: Unpaid, Awaiting Review (submitted), Verified or Rejected. **Balance**: what you still owe at the climb’s current fees.",
      "**Waiver**: the Waiver & Release of Liability you sign by typing your name. **Received offline**: a waiver or document the organizers recorded as given on paper or in person.",
      "**My Details**: your saved details that fill in your next registration.",
      "**Officer**: a member helping run a specific climb. **Admin**: an account with full administrative access.",
    ],
  },
];
