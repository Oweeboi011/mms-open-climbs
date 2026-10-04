import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/firebase/config";
import { compressImage } from "@/utils/compressImage";
import { makeUploadTimestamp } from "@/utils/uploadTimestamp";

export async function uploadFile(path, file) {
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

// Every member file (payment proofs, required documents) lives at
// `{prefix}/{climbId}/{owner}/{timestamp}_{name}`. A walk-in added by an admin
// has no userId, so the registration id stands in — otherwise every such
// participant's files would pile into one shared `null/` folder.
export async function uploadRegistrationFile(prefix, reg, original, { namePrefix = "" } = {}) {
  const file = await compressImage(original);
  const owner = reg.userId || reg.id;
  const url = await uploadFile(
    `${prefix}/${reg.climbId}/${owner}/${makeUploadTimestamp()}_${namePrefix}${file.name}`,
    file,
  );
  return { url, fileName: file.name };
}
