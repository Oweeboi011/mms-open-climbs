import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";
import { logFailedRequest } from "@/utils/logFailedRequest";

const RATING_LABELS = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Excellent",
};

export default function ClimbFeedback() {
  const { climbId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [climb, setClimb] = useState(null);
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const feedbackId = `${climbId}_${currentUser?.uid}`;

  useEffect(() => {
    async function load() {
      const [climbSnap, feedbackSnap] = await Promise.all([
        getDoc(doc(db, "climbs", climbId)),
        getDoc(doc(db, "feedback", feedbackId)),
      ]);
      if (!climbSnap.exists()) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setClimb({ id: climbSnap.id, ...climbSnap.data() });
      if (feedbackSnap.exists()) {
        setExisting(feedbackSnap.data());
      }
      setLoading(false);
    }
    load();
  }, [climbId, feedbackId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (rating < 1) {
      setError("Please choose a star rating.");
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, "feedback", feedbackId), {
        climbId,
        climbTitle: climb?.title || "",
        userId: currentUser.uid,
        name: currentUser.displayName || "",
        rating,
        comments: comments.trim(),
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      setError("Failed to submit feedback. Please try again.");
      logFailedRequest({
        type: "firestore",
        source: "ClimbFeedback.jsx:submit",
        message: err?.message,
        path: window.location.pathname,
        userId: currentUser?.uid,
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="myreg-page">
      <Header />
      <main className="myreg-main">
        <div className="myreg-heading">
          <h1 className="myreg-title">Climb Feedback</h1>
          <p className="myreg-email">
            {climb?.title ? `How was ${climb.title}?` : "Tell us how it went"}
          </p>
        </div>

        {notFound ? (
          <p className="tbd-note">Climb not found.</p>
        ) : existing || submitted ? (
          <div className="reg-card">
            <div className="reg-card-header">
              <div className="reg-card-title">Thanks for the feedback!</div>
            </div>
            <div className="reg-card-body">
              <p style={{ marginBottom: 12 }}>
                You rated this climb{" "}
                <strong>
                  {"★".repeat(existing?.rating || rating)}
                  {"☆".repeat(5 - (existing?.rating || rating))}
                </strong>{" "}
                ({RATING_LABELS[existing?.rating || rating]}).
              </p>
              {(existing?.comments || comments) && (
                <p style={{ color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>
                  &ldquo;{existing?.comments || comments}&rdquo;
                </p>
              )}
              <Link to="/my-registrations" className="btn btn-outline btn-sm" style={{ marginTop: 16 }}>
                Back to My Climbs
              </Link>
            </div>
          </div>
        ) : (
          <form className="reg-card" onSubmit={handleSubmit}>
            <div className="reg-card-body">
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label className="form-label required">Your Rating</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "2rem",
                        lineHeight: 1,
                        padding: 2,
                        color:
                          n <= (hoverRating || rating)
                            ? "var(--gold)"
                            : "var(--border)",
                      }}
                    >
                      &#9733;
                    </button>
                  ))}
                </div>
                {(hoverRating || rating) > 0 && (
                  <div className="form-hint">
                    {RATING_LABELS[hoverRating || rating]}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Comments (optional)</label>
                <textarea
                  className="form-input"
                  rows={5}
                  placeholder="What went well? What could be better next time?"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  className="btn btn-primary btn-lg"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner spinner-sm" /> Submitting…
                    </>
                  ) : (
                    "Submit Feedback"
                  )}
                </button>
                <button
                  className="btn btn-outline btn-lg"
                  type="button"
                  onClick={() => navigate("/my-registrations")}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
