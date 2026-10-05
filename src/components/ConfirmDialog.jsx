import { useId, useRef } from "react";
import Modal from "@/components/Modal";
import "./ConfirmDialog.css";

// An accessible yes/no step for destructive or far-reaching actions — the
// app's replacement for window.confirm (banned by lint: it blocks the page,
// can't be styled, and is unreliable in mobile in-app browsers).
export default function ConfirmDialog({
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  error = "",
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const cancelRef = useRef(null);
  return (
    <Modal onClose={busy ? undefined : onCancel} labelledBy={titleId} initialFocusRef={cancelRef} closeOnBackdrop={!busy}>
      <h2 id={titleId} className="confirm-title">
        {title}
      </h2>
      {children && <div className="confirm-body">{children}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <div className="confirm-actions">
        <button ref={cancelRef} type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button type="button" className={danger ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm} disabled={busy}>
          {busy ? <span className="spinner spinner-sm" /> : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
