import { useId } from "react";
import Modal from "@/components/Modal";
import "./GcashQrModal.css";

// The climb's GCash QR code, large enough to scan from another phone.
export default function GcashQrModal({ climb, onClose, layer = "base" }) {
  const titleId = useId();
  return (
    <Modal onClose={onClose} labelledBy={titleId} variant="spotlight" layer={layer} showClose={false}>
      <div id={titleId} className="gcash-qr-title">
        GCash QR Code
      </div>
      {climb?.gcashName && (
        <div className="gcash-qr-account">
          {climb.gcashName}
          {climb.gcashNumber ? ` · ${climb.gcashNumber}` : ""}
        </div>
      )}
      {climb?.gcashQrUrl ? (
        <img className="gcash-qr-image" src={climb.gcashQrUrl} alt="GCash QR Code" />
      ) : (
        <div className="gcash-qr-missing">
          QR code has not been uploaded yet.
          <br />
          Please contact the climb officers for the GCash number.
        </div>
      )}
      <button type="button" className="btn btn-outline btn-sm gcash-qr-close" onClick={onClose}>
        Close
      </button>
    </Modal>
  );
}
