import SectionCard from "@/components/SectionCard";
import { renderMarkdown } from "@/utils/markdownLite";
import "./event.css";

// Pinned reminders first, then newest.
function byPinnedThenNewest(a, b) {
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  return (b.createdAt || 0) - (a.createdAt || 0);
}

export default function Announcements({ climb }) {
  if (!climb.announcements?.length) return null;
  return (
    <SectionCard icon="alert" title="Announcements">
      {[...climb.announcements].sort(byPinnedThenNewest).map((note, i) => (
        <div key={i} className="announcement">
          {note.pinned && <span className="announcement-pill">Reminder</span>}
          <div className="announcement-body">
            <div className="md-body">{renderMarkdown(note.message)}</div>
            {note.createdAt && (
              <div className="announcement-date">
                {new Date(note.createdAt).toLocaleDateString("en-PH", { dateStyle: "medium" })}
              </div>
            )}
          </div>
        </div>
      ))}
    </SectionCard>
  );
}
