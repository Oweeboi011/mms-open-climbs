import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useGuide } from "@/contexts/GuideContext";

const STORAGE_KEY = (uid) => `oc_welcomed_${uid}`;

const STEPS = [
  {
    icon: "🏔",
    title: "Browse Climbs",
    body: "The Schedule page lists all upcoming climbs. Click any climb card to view details — trail info, difficulty, fees, and dates.",
  },
  {
    icon: "📋",
    title: "Register for a Climb",
    body: "Open a climb and click Register. Fill in your personal details, emergency contact, and experience level.",
  },
  {
    icon: "💳",
    title: "Upload Payment Proof",
    body: "Pay via GCash using the QR code shown during registration, then upload a screenshot of your receipt. Accepted formats: JPG, PNG (max 10 MB).",
  },
  {
    icon: "✅",
    title: "Track Your Registrations",
    body: "Check My Registrations to see your status. An admin will review and confirm your slot. You'll receive an email once confirmed.",
  },
  {
    icon: "📄",
    title: "Waiver & Print",
    body: "A waiver is included in the registration form. Once confirmed, you can print your waiver from My Registrations for on-site submission.",
  },
];

export default function WelcomeModal() {
  const { currentUser, userProfile } = useAuth();
  const { guideOpen, setGuideOpen } = useGuide();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-show once per user per browser on first login
  useEffect(() => {
    if (!currentUser) return;
    const seen = localStorage.getItem(STORAGE_KEY(currentUser.uid));
    if (!seen) setOpen(true);
  }, [currentUser]);

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
              MMS Open Climbs 2026 — Quick Guide
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
          <div className="welcome-step-title">{current.title}</div>
          <div className="welcome-step-body">{current.body}</div>
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
            <Link to="/" className="btn btn-primary" onClick={dismiss}>
              Get Started
            </Link>
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
