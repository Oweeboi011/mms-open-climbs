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
import {
  parseReleaseNoteBody,
  releaseNoteSectionStyle,
} from "@/utils/parseReleaseNoteBody";

export default function ReleaseNotes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "releaseNotes"),
      where("status", "==", "published"),
      orderBy("publishedAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setNotes(docs);
      setExpandedId((prev) =>
        prev && docs.some((n) => n.id === prev) ? prev : docs[0]?.id ?? null,
      );
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
          <div className="rn-timeline">
            {notes.map((note, index) => {
              const isExpanded = note.id === expandedId;
              return (
                <div
                  className={`rn-timeline-item ${index === 0 ? "rn-timeline-item--latest" : ""}`}
                  key={note.id}
                >
                  <span className="rn-timeline-dot" aria-hidden="true" />
                  <div className="reg-card">
                    <button
                      type="button"
                      className="reg-card-header rn-header"
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedId((prev) =>
                          prev === note.id ? null : note.id,
                        )
                      }
                    >
                      <div>
                        <div className="reg-card-title">{note.title}</div>
                        <div className="reg-card-date">
                          {note.publishedAt
                            ?.toDate?.()
                            .toLocaleDateString("en-PH", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }) || ""}
                        </div>
                      </div>
                      <span
                        className={`rn-chevron ${isExpanded ? "rn-chevron--open" : ""}`}
                      >
                        ▾
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="reg-card-body rn-body">
                        {parseReleaseNoteBody(note.body).map((block, i) =>
                          block.type === "list" ? (
                            <div className="rn-section" key={i}>
                              {block.heading && (
                                <div
                                  className={`rn-section-title rn-section-title--${releaseNoteSectionStyle(block.heading)}`}
                                >
                                  {block.heading}
                                </div>
                              )}
                              <ul className="rn-list">
                                {block.items.map((item, j) => (
                                  <li key={j}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <p className="rn-paragraph" key={i}>
                              {block.text}
                            </p>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
