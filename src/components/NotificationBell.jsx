import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { markNotificationRead, subscribeToUserNotifications } from "@/services/notifications";
import { useAuth } from "@/contexts/AuthContext";
import { renderMarkdownLite } from "@/utils/markdownLite";

function timeAgo(date) {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-PH");
}

export default function NotificationBell() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;
    return subscribeToUserNotifications(currentUser.uid, 30, setNotifications);
  }, [currentUser]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!currentUser) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markRead(notif) {
    if (!notif.read) {
      await markNotificationRead(notif.id);
    }
  }

  async function markAllRead() {
    await Promise.all(
      notifications
        .filter((n) => !n.read)
        .map((n) => markNotificationRead(n.id)),
    );
  }

  async function handleClick(notif) {
    await markRead(notif);
    setOpen(false);
    if (notif.link) navigate(notif.link);
  }

  return (
    <div className="notif-bell-wrap" ref={panelRef}>
      <button
        className="notif-bell-btn"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        &#128276;
        {unreadCount > 0 && (
          <span className="notif-bell-count">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-bell-panel">
          <div className="notif-bell-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button className="notif-bell-markall" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="notif-bell-empty">You're all caught up.</div>
          ) : (
            <div className="notif-bell-list">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  className={`notif-bell-item${n.read ? "" : " unread"}`}
                  onClick={() => handleClick(n)}
                >
                  <div className="notif-bell-item-title">{n.title}</div>
                  {n.message && (
                    <div className="notif-bell-item-msg">
                      {/* The row is a button; a link inside it would be
                          nested interactive content. */}
                      {renderMarkdownLite(n.message, { links: false })}
                    </div>
                  )}
                  <div className="notif-bell-item-time">
                    {timeAgo(n.createdAt?.toDate?.())}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
