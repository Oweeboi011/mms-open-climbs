import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

// Calls a Cloud Functions callable by name and returns its `data`. The
// catalogue of callables lives in docs/guides/API.md.
export async function callFunction(name, payload) {
  const result = await httpsCallable(functions, name)(payload);
  return result?.data;
}
