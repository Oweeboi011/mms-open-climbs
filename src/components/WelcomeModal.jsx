import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useGuide } from "@/contexts/GuideContext";

const STORAGE_KEY = (uid) => `oc_welcomed_${uid}`;
const AUTO_OPEN_PATHS = ["/", "/my-registrations"];

const MEMBER_STEPS = [
  {
    icon: "🏔",
    title: "Browse Climbs",
    body: "The Schedule page lists all upcoming climbs. Click any climb card to view details — trail info, difficulty, fees, and dates.",
    bullets: [
      'Use the Home page or the "Schedule" link in the top navigation to see what\'s coming up.',
      "Each card shows the destination, date, and remaining slots at a glance.",
      "Click a card to open the full event page before deciding to register.",
    ],
  },
  {
    icon: "📋",
    title: "Register for a Climb",
    body: "Open a climb and click Register. Fill in your personal details, emergency contact, and experience level.",
    bullets: [
      "You must be logged in to register — sign up first if you haven't already.",
      "Double-check your emergency contact details; officers rely on these on the trail.",
      "Submitting the form creates a pending registration you can track afterward.",
    ],
  },
  {
    icon: "💳",
    title: "Upload Payment Proof",
    body: "Pay via GCash using the QR code shown during registration, then upload a screenshot of your receipt. Accepted formats: JPG, PNG (max 10 MB).",
    bullets: [
      "Scan the GCash QR code shown on the registration form and pay the exact climb fee.",
      "Take a clear screenshot of the GCash receipt showing the reference number.",
      "Upload it right away — your slot isn't confirmed until an admin verifies the proof.",
    ],
  },
  {
    icon: "✅",
    title: "Track Your Registrations",
    body: "Check My Climbs to see your status. An admin will review and confirm your slot. You'll receive an email once confirmed.",
    bullets: [
      'Open "My Climbs" from the account menu to see every climb you\'ve signed up for.',
      "Status moves from Pending → Confirmed once an admin verifies your payment.",
      "You'll get an email notification the moment your status changes.",
    ],
  },
  {
    icon: "📄",
    title: "Waiver & Print",
    body: "A waiver is included in the registration form. Once confirmed, you can print your waiver from My Climbs for on-site submission.",
    bullets: [
      "The digital waiver is signed as part of registration — no separate step needed.",
      "Once confirmed, use the Print Waiver button in My Climbs for a physical copy.",
      "Bring the printed waiver on climb day; organizers may ask for it at check-in.",
    ],
  },
];

const ADMIN_STEPS = [
  {
    icon: "🛠",
    title: "Admin Dashboard",
    body: "The Admin Dashboard is your control center — quick links to climbs, registrations, payments, users, and analytics.",
    bullets: [
      'Reach it any time via "Admin" in the top navigation (visible only to admin accounts).',
      "It summarizes pending payments, open registrations, and upcoming climbs at a glance.",
      "Use it as your starting point before diving into a specific management page.",
    ],
  },
  {
    icon: "🗓",
    title: "Manage Climbs",
    body: "Create, edit, and publish climb events from Admin → Climbs. Set schedule, fees, slot limits, and difficulty.",
    bullets: [
      "Go to Admin → Climbs to see every event, draft or published.",
      'Click "New Climb" to add one, or open an existing card to edit details.',
      "Fields like slot limits and fees directly affect what members see on the public Schedule.",
    ],
  },
  {
    icon: "💰",
    title: "Verify Payments",
    body: "Admin → Payments shows uploaded GCash proofs awaiting review. Approve or reject to move a registration to Confirmed.",
    bullets: [
      "Open each pending proof to check the amount and reference number against GCash.",
      "Approving triggers a confirmation email to the member automatically.",
      "Rejecting lets you leave a note so the member knows what to fix and re-upload.",
    ],
  },
  {
    icon: "📝",
    title: "Registrations & Users",
    body: "Admin → Registrations lists every sign-up across all climbs. Admin → Users lets you manage roles and link Add Joiner entries.",
    bullets: [
      "Filter registrations by climb or status to help officers plan headcount.",
      "In Admin → Users, promote a member to admin or adjust their profile as needed.",
      'You can link a manually added "Add Joiner" entry to an existing member account.',
    ],
  },
  {
    icon: "📊",
    title: "Analytics & Release Notes",
    body: "Admin → Analytics tracks page views and registration trends. Admin → Release Notes lets you publish updates members will see in-app.",
    bullets: [
      "Analytics helps you spot which climbs and pages get the most traffic.",
      "Use Release Notes to announce new features or fixes to all members.",
      "Published notes appear to members automatically — no separate email needed.",
    ],
  },
];

export default function WelcomeModal() {
  const { currentUser, userProfile, isAdmin } = useAuth();
  const { guideOpen, setGuideOpen } = useGuide();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const STEPS = isAdmin ? [...MEMBER_STEPS, ...ADMIN_STEPS] : MEMBER_STEPS;

  // Auto-show once per user per browser on first login — but only on pages
  // the user chose to be on. Signing up from a climb lands on /register/:id,
  // and throwing a 5-step guide over the form they were reaching for is the
  // worst possible moment. The flag is written by dismiss(), so deferring
  // here means they still get the guide the first time they hit the schedule.
  useEffect(() => {
    if (!currentUser || !AUTO_OPEN_PATHS.includes(pathname)) return;
    const seen = localStorage.getItem(STORAGE_KEY(currentUser.uid));
    if (!seen) setOpen(true);
  }, [currentUser, pathname]);

  // Externally triggered (from header icon)
  useEffect(() => {
    if (guideOpen) {
      setStep(0);
      setOpen(true);
      setGuideOpen(false);
    }
  }, [guideOpen, setGuideOpen]);

  function dismiss() {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEY(currentUser.uid), "1");
    }
    setOpen(false);
  }

  if (!open || !currentUser) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div
      className="welcome-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome guide"
    >
      <div className="welcome-modal">
        {/* Header */}
        <div className="welcome-header">
          <img src="/MMS.png" alt="MMS" className="welcome-logo" />
          <div>
            <div className="welcome-title">
              Welcome,{" "}
              {userProfile?.displayName || currentUser.displayName || "Climber"}
              !
            </div>
            <div className="welcome-subtitle">
              MMS Open Climbs 2026 —{" "}
              {isAdmin ? "Member & Admin Guide" : "Quick Guide"}
            </div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="welcome-steps-row">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`welcome-dot${i === step ? " active" : ""}${i < step ? " done" : ""}`}
              onClick={() => setStep(i)}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="welcome-step">
          <div className="welcome-step-icon">{current.icon}</div>
          {isAdmin && step >= MEMBER_STEPS.length && (
            <div className="welcome-step-badge">Admin</div>
          )}
          <div className="welcome-step-title">{current.title}</div>
          <div className="welcome-step-body">{current.body}</div>
          {current.bullets && (
            <ul className="welcome-step-bullets">
              {current.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="welcome-actions">
          {step > 0 && (
            <button
              className="btn btn-secondary"
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {!isLast ? (
            <button
              className="btn btn-primary"
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </button>
          ) : (
            <button className="btn btn-primary" onClick={dismiss}>
              Get Started
            </button>
          )}
        </div>

        {/* Skip */}
        <button className="welcome-skip" onClick={dismiss}>
          Skip guide
        </button>
      </div>
    </div>
  );
}
