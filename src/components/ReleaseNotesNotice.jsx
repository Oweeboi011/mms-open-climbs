import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";

export default function ReleaseNotesNotice() {
  const { currentUser, userProfile } = useAuth();
  const [latestNote, setLatestNote] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "releaseNotes"),
      where("status", "==", "published"),
      orderBy("publishedAt", "desc"),
      limit(1),
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        setLatestNote({ id: d.id, ...d.data() });
      }
    });
    return unsub;
  }, [currentUser]);

  if (!currentUser || !latestNote) return null;
  if (latestNote.id === userProfile?.lastSeenReleaseNoteId) return null;

  function dismiss() {
    updateDoc(doc(db, "users", currentUser.uid), {
      lastSeenReleaseNoteId: latestNote.id,
    }).catch(() => {});
  }

  return (
    <div
      className="welcome-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="What's new"
    >
      <div className="welcome-modal">
        <div className="welcome-header">
          <img src="/MMS.png" alt="MMS" className="welcome-logo" />
          <div>
            <div className="welcome-title">What&rsquo;s New</div>
            <div className="welcome-subtitle">{latestNote.title}</div>
          </div>
        </div>

        <div className="welcome-step">
          <div className="welcome-step-body" style={{ whiteSpace: "pre-line" }}>
            {latestNote.body}
          </div>
        </div>

        <div className="welcome-actions">
          <div style={{ flex: 1 }} />
          <Link
            to="/release-notes"
            className="btn btn-outline"
            onClick={dismiss}
          >
            View All Updates
          </Link>
          <button className="btn btn-primary" onClick={dismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
