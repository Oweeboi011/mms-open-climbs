import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { itineraryActions, listActions } from "@/pages/admin/climbForm/formActions";
import { buildClimbDocs, formFromClimb, invalidOfficerEmailMessage } from "@/pages/admin/climbForm/climbFormModel";
import { EMPTY_FORM } from "@/pages/admin/climbForm/climbFormShared";
import { logAuditEvent } from "@/services/auditLog";
import { createClimb, getClimb, getClimbOfficerEmails, getClimbPrivate, saveClimbInternal, saveClimbPrivate, updateClimb } from "@/services/climbs";
import { serverTimestamp } from "@/services/firestore";
import { logFailedRequest } from "@/services/logFailedRequest";
import { uploadFile } from "@/services/storage";
import { listUsersByName } from "@/services/users";

// Everything the climb form holds and does: loading an existing climb,
// list editing, uploads and the three-document save. The page and its
// editors only render.
export default function useClimbForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [gcashUploading, setGcashUploading] = useState(false);
  const [docUploading, setDocUploading] = useState({});
  const [trailImgUploading, setTrailImgUploading] = useState(false);
  const [trailUrlInput, setTrailUrlInput] = useState("");

  useEffect(() => {
    listUsersByName()
      .then((list) => setUsers(list.map(({ id: uid, ...user }) => ({ uid, ...user }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    Promise.all([getClimb(id), getClimbPrivate(id), getClimbOfficerEmails(id)]).then(
      ([climbDoc, privateDoc, officerEmails]) => {
        if (climbDoc) setForm(formFromClimb(climbDoc, privateDoc, officerEmails));
        setLoading(false);
      },
    );
  }, [id, isEdit]);

  function set(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  const { addListItem, removeListItem, moveListItem, updateListItem } = listActions(setForm);
  const { addDay, removeDay, updateDay, addEntry, removeEntry, moveEntry, updateEntry } =
    itineraryActions(setForm);

  async function handleTrailImageUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setTrailImgUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadFile(`trail-images/${id || "new"}/${Date.now()}_${file.name}`, file));
      }
      set("trailImages", [...(form.trailImages || []), ...uploaded]);
    } catch (err) {
      setError("Failed to upload trail image: " + err.message);
      logFailedRequest({
        type: "upload",
        source: "ClimbForm.jsx:trailImageUpload",
        message: err?.message,
        path: window.location.pathname,
        userId: currentUser?.uid,
        userRole: "admin",
        climbId: id,
      });
    } finally {
      setTrailImgUploading(false);
      e.target.value = "";
    }
  }

  async function handleGcashQrUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setGcashUploading(true);
    try {
      set("gcashQrUrl", await uploadFile(`gcash-qr/${id || "new"}/${Date.now()}_${file.name}`, file));
    } catch (err) {
      setError("Failed to upload GCash QR image: " + err.message);
      logFailedRequest({
        type: "upload",
        source: "ClimbForm.jsx:gcashQrUpload",
        message: err?.message,
        path: window.location.pathname,
        userId: currentUser?.uid,
        userRole: "admin",
        climbId: id,
      });
    } finally {
      setGcashUploading(false);
    }
  }
  async function handleDocUpload(e, urlField, fileNameField, storagePrefix) {
    const file = e.target.files[0];
    if (!file) return;
    setDocUploading((p) => ({ ...p, [urlField]: true }));
    try {
      const url = await uploadFile(`${storagePrefix}/${id || "new"}/${Date.now()}_${file.name}`, file);
      setForm((p) => ({ ...p, [urlField]: url, [fileNameField]: file.name }));
    } catch (err) {
      setError("Failed to upload file: " + err.message);
      logFailedRequest({
        type: "upload",
        source: "ClimbForm.jsx:docUpload",
        message: err?.message,
        path: window.location.pathname,
        userId: currentUser?.uid,
        userRole: "admin",
        climbId: id,
      });
    } finally {
      setDocUploading((p) => ({ ...p, [urlField]: false }));
      e.target.value = "";
    }
  }
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const officerError = invalidOfficerEmailMessage(form.officers);
    if (officerError) {
      setError(officerError);
      return;
    }

    setSaving(true);
    try {
      const { payload, privateData, internalData } = buildClimbDocs(form);
      if (isEdit) {
        await updateClimb(id, payload);
        await saveClimbPrivate(id, privateData);
        await saveClimbInternal(id, internalData);
        logAuditEvent({
          actorUid: currentUser?.uid,
          actorName: currentUser?.displayName || currentUser?.email,
          action: "climb_updated",
          targetType: "climb",
          targetId: id,
          targetLabel: form.title,
        });
      } else {
        payload.createdAt = serverTimestamp();
        payload.createdBy = currentUser.uid;
        payload.registrationCount = 0;
        const newId = await createClimb(payload);
        await saveClimbPrivate(newId, privateData);
        await saveClimbInternal(newId, internalData);
        logAuditEvent({
          actorUid: currentUser?.uid,
          actorName: currentUser?.displayName || currentUser?.email,
          action: "climb_created",
          targetType: "climb",
          targetId: newId,
          targetLabel: form.title,
        });
      }
      navigate("/admin/climbs");
    } catch (err) {
      setError("Save failed: " + err.message);
      logFailedRequest({
        type: "firestore",
        source: "ClimbForm.jsx:save",
        message: err?.message,
        path: window.location.pathname,
        userId: currentUser?.uid,
        userRole: "admin",
        climbId: id,
      });
    } finally {
      setSaving(false);
    }
  }

  return {
    addDay, addEntry, addListItem, docUploading, error, form, gcashUploading, handleDocUpload,
    handleGcashQrUpload, handleSubmit, handleTrailImageUpload, isEdit, loading, moveEntry,
    moveListItem, navigate, removeDay, removeEntry, removeListItem, saving, set, setForm,
    setTrailUrlInput, trailImgUploading, trailUrlInput, updateDay, updateEntry, updateListItem,
    users,
  };
}
