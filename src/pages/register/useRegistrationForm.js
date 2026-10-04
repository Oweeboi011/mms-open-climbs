import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FIELD_ORDER, INITIAL_FORM } from "@/pages/register/registerShared";
import {
  buildRegistrationDoc,
  missingDocLabels,
  uploadRegistrationFiles,
  validateRegistration,
} from "@/pages/register/registrationSubmit";
import { getClimb } from "@/services/climbs";
import { logFailedRequest } from "@/services/logFailedRequest";
import { createRegistration, findUserRegistrationsForClimb } from "@/services/registrations";

function reportFailure(type, source, err, { currentUser, userProfile, climbId }) {
  logFailedRequest({
    type,
    source,
    message: err?.message,
    path: window.location.pathname,
    userId: currentUser?.uid,
    userRole: userProfile?.role === "admin" ? "admin" : "member",
    climbId,
  });
}

// Everything the register page holds and does: loading the climb, form
// state, validation, and the upload-then-create submit. The page and its
// sections only render.
export default function useRegistrationForm() {
  const { climbId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [climb, setClimb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(INITIAL_FORM);
  const [waiverAgreed, setWaiverAgreed] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [sigName, setSigName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [blockedReason, setBlockedReason] = useState(null);
  const [successRegId, setSuccessRegId] = useState(null);
  const [successUnpaid, setSuccessUnpaid] = useState(false);
  const [successMissingDocs, setSuccessMissingDocs] = useState([]);
  const [paymentFiles, setPaymentFiles] = useState([]);
  const [paymentPreviews, setPaymentPreviews] = useState([]);
  const [paymentNote, setPaymentNote] = useState("");
  const [pledge, setPledge] = useState({ cashPledge: "", inKind: "", payWithFees: true });
  const [paymentUploading, setPaymentUploading] = useState(false);
  const [amountPaid, setAmountPaid] = useState("");
  const [optionalFeeSelections, setOptionalFeeSelections] = useState({});
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [docFiles, setDocFiles] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);

  const failureContext = { currentUser, userProfile, climbId };
  const fieldRefs = useRef({});
  function bindField(key) {
    return (node) => {
      fieldRefs.current[key] = node;
    };
  }
  function inputClass(key, base = "form-input") {
    return fieldErrors[key] ? `${base} input-error` : base;
  }

  useEffect(() => {
    async function load() {
      try {
        const climbData = await getClimb(climbId);
        if (!climbData) {
          navigate("/", { replace: true });
          return;
        }

        if (climbData.status !== "open") {
          // Was a silent navigate("/"). A member who taps a shared link to a
          // climb that has since closed deserves to be told, on the page they
          // asked for.
          setClimb(climbData);
          setBlockedReason("closed");
          return;
        }

        // Check not already registered
        const [existing] = await findUserRegistrationsForClimb(climbId, currentUser.uid);
        if (existing && existing.status !== "cancelled") {
          setClimb(climbData);
          setBlockedReason("registered");
          return;
        }

        setClimb(climbData);
        setForm((p) => ({
          ...p,
          fullName: userProfile?.displayName || currentUser.displayName || "",
        }));
      } catch (err) {
        console.error(err);
        setError("Could not load this climb. Please refresh and try again.");
        reportFailure("firestore", "Register.jsx:load", err, { currentUser, userProfile, climbId });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [climbId, currentUser, userProfile, navigate]);

  function setField(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
    clearFieldError(field);
  }

  function clearFieldError(key) {
    setFieldErrors((p) => {
      if (!p[key]) return p;
      const next = { ...p };
      delete next[key];
      return next;
    });
  }

  function validate() {
    return validateRegistration({ form, waiverAgreed, privacyConsent, sigName, amountPaid, paymentFiles });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const { errors } = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Please complete the following before submitting:");
      // The summary alert sits at the top of a form the user has scrolled to
      // the bottom of. Without this the page appears to do nothing at all.
      const firstKey = FIELD_ORDER.find((k) => errors[k]);
      const node = fieldRefs.current[firstKey];
      if (typeof node?.scrollIntoView === "function") {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (typeof node?.focus === "function") {
        node.focus({ preventScroll: true });
      }
      return;
    }

    // Show a confirmation modal recapping the climb and what will happen —
    // pay now vs. settle later — before actually creating the registration.
    setShowConfirm(true);
  }

  async function doSubmit() {
    setShowConfirm(false);
    const { parsedAmount } = validate();
    setSubmitting(true);
    let uploads;
    try {
      uploads = await uploadRegistrationFiles({
        climbId,
        userId: currentUser.uid,
        paymentFiles,
        docFiles,
        onPaymentUpload: setPaymentUploading,
      });
    } catch (uploadErr) {
      setPaymentUploading(false);
      setSubmitting(false);
      setError("Failed to upload one of your files. Please try again.");
      reportFailure("upload", "Register.jsx:paymentUpload", uploadErr, failureContext);
      return;
    }
    try {
      const newRegId = await createRegistration(
        buildRegistrationDoc({
          climb,
          user: currentUser,
          form,
          sigName,
          uploads,
          parsedAmount,
          paymentNote,
          optionalFeeSelections,
          pledge,
        }),
      );
      setSuccessUnpaid(uploads.paymentProofs.length === 0);
      setSuccessMissingDocs(missingDocLabels(climb, uploads.docUploads));
      setSuccessRegId(newRegId);
    } catch (err) {
      console.error(err);
      setError("Registration failed. Please try again.");
      reportFailure("firestore", "Register.jsx:createRegistration", err, failureContext);
    } finally {
      setSubmitting(false);
    }
  }

  return {
    amountPaid, bindField, blockedReason, clearFieldError, climb, climbId, currentUser,
    doSubmit, docFiles, error, fieldErrors, form, handleSubmit, inputClass, loading, navigate,
    optionalFeeSelections, paymentFiles, paymentNote, paymentPreviews, paymentUploading,
    pledge, privacyConsent, qrModalOpen, setAmountPaid, setDocFiles, setField,
    setOptionalFeeSelections, setPaymentFiles, setPaymentNote, setPaymentPreviews, setPledge,
    setPrivacyConsent, setQrModalOpen, setShowConfirm, setSigName, setWaiverAgreed,
    showConfirm, sigName, submitting, successMissingDocs, successRegId, successUnpaid,
    waiverAgreed,
  };
}
