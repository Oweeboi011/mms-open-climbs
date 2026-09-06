import { useEffect, useRef } from "react";

// Shared dialog shell: backdrop, centred card, and the accessibility behaviour
// every modal in the app needs but most hand-rolled ones skipped — labelled
// role="dialog", Escape to close, focus moved in on open and restored on close,
// a focus trap, and a body-scroll lock. Callers keep their own inner markup and
// their own Cancel/Save buttons; the "×" here is additive.
//
// Nesting (e.g. a confirm step opened over a form) is supported through a
// module-level stack: Escape and the Tab trap only act for the top-most dialog,
// and the scroll lock is reference-counted so closing an inner dialog doesn't
// unlock the page while an outer one is still open.

const modalStack = [];
let scrollLockCount = 0;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const DEFAULT_OVERLAY = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background: "rgba(0,0,0,0.6)",
};

const DEFAULT_CONTENT = {
  position: "relative",
  background: "var(--surface)",
  borderRadius: 12,
  padding: 24,
  maxWidth: 420,
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
};

export default function Modal({
  onClose,
  label,
  labelledBy,
  describedBy,
  closeOnBackdrop = true,
  initialFocusRef,
  showClose = true,
  overlayStyle,
  contentStyle,
  zIndex = 1000,
  children,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    const entry = { dialog, onClose };
    modalStack.push(entry);

    if (scrollLockCount === 0) {
      document.body.style.overflow = "hidden";
    }
    scrollLockCount += 1;

    // Defer focus so the node is laid out; prefer a caller-nominated field.
    const focusTarget = initialFocusRef?.current || dialog;
    focusTarget?.focus?.({ preventScroll: true });

    function onKeyDown(e) {
      if (modalStack[modalStack.length - 1] !== entry) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key === "Tab" && dialog) {
        const focusables = [...dialog.querySelectorAll(FOCUSABLE)].filter(
          (el) => el.offsetParent !== null || el === document.activeElement,
        );
        if (focusables.length === 0) {
          e.preventDefault();
          dialog.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const idx = modalStack.indexOf(entry);
      if (idx !== -1) modalStack.splice(idx, 1);
      scrollLockCount = Math.max(0, scrollLockCount - 1);
      if (scrollLockCount === 0) {
        document.body.style.overflow = "";
      }
      previouslyFocused?.focus?.({ preventScroll: true });
    };
    // onClose / refs are read fresh via the entry closure on each keydown; the
    // effect intentionally runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={closeOnBackdrop ? () => onClose?.() : undefined}
      style={{ ...DEFAULT_OVERLAY, zIndex, ...overlayStyle }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ ...DEFAULT_CONTENT, ...contentStyle }}
      >
        {showClose && (
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 12,
              right: 14,
              background: "none",
              border: "none",
              fontSize: "1.2rem",
              lineHeight: 1,
              cursor: "pointer",
              color: "var(--ink-soft)",
              padding: 4,
            }}
          >
            &#x2715;
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
