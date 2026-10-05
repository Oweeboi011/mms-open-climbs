import { useEffect, useRef } from "react";
import "./Modal.css";

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

export default function Modal({
  onClose,
  label,
  labelledBy,
  describedBy,
  closeOnBackdrop = true,
  initialFocusRef,
  showClose = true,
  // sm 420px (default) · md 460 · lg 520 · wide 720 · xl 960
  size = "sm",
  // "top" stacks above another open dialog (e.g. a receipt over a form).
  layer = "base",
  variant = "default",
  className = "",
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
      className={`modal-overlay modal-overlay--${layer} modal-overlay--${variant}`}
      onClick={closeOnBackdrop ? () => onClose?.() : undefined}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={`modal-card modal-card--${size} modal-card--${variant} ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        {showClose && (
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close"
            className="modal-close"
          >
            &#x2715;
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
