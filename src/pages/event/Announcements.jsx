import Icon from "@/components/Icon";
import { renderMarkdown } from "@/utils/markdownLite";

export default function Announcements({ climb }) {
  return (
    <>
      {/* Announcements */}
      {climb.announcements?.length > 0 && (
        <div className="section-card">
          <div className="section-header">
            <span className="icon">
              <Icon name="alert" size={17} />
            </span>
            <h3>Announcements</h3>
          </div>
          <div className="section-body">
            {[...climb.announcements]
              .sort((a, b) => {
                if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
                return (b.createdAt || 0) - (a.createdAt || 0);
              })
              .map((note, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "10px 0",
                    borderTop: i > 0 ? "1px solid rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  {note.pinned && (
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 800,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        color: "var(--green-dark)",
                        background: "rgba(13,43,18,0.08)",
                        padding: "2px 8px",
                        borderRadius: 99,
                        whiteSpace: "nowrap",
                        marginTop: 2,
                      }}
                    >
                      Reminder
                    </span>
                  )}
                  {/* 280px basis: wide enough that, beside the Reminder
                      pill, it overflows a phone's ~326px card, so the pill
                      wraps above the text instead of holding a narrow
                      column beside a long announcement. */}
                  <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                    <div className="md-body">
                      {renderMarkdown(note.message)}
                    </div>
                    {note.createdAt && (
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--ink-soft)",
                          marginTop: 4,
                        }}
                      >
                        {new Date(note.createdAt).toLocaleDateString(
                          "en-PH",
                          { dateStyle: "medium" },
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
