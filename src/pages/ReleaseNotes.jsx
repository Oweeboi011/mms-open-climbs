import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function ReleaseNotes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "releaseNotes"),
      where("status", "==", "published"),
      orderBy("publishedAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <div className="myreg-page">
      <Header />
      <main className="myreg-main">
        <div className="myreg-heading">
          <h1 className="myreg-title">Release Notes</h1>
          <p className="myreg-email">What&rsquo;s new on MMS Open Climbs</p>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : notes.length === 0 ? (
          <p className="tbd-note">No release notes yet.</p>
        ) : (
          notes.map((note) => (
            <div className="reg-card" key={note.id}>
              <div className="reg-card-header">
                <div>
                  <div className="reg-card-title">{note.title}</div>
                  <div className="reg-card-date">
                    {note.publishedAt?.toDate?.().toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }) || ""}
                  </div>
                </div>
              </div>
              <p style={{ whiteSpace: "pre-line", marginTop: 10 }}>
                {note.body}
              </p>
            </div>
          ))
        )}
      </main>
      <Footer />
    </div>
  );
}
