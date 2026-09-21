const DB_NAME = "splexanode-share";
const STORE = "recovery";
export type RecoveryRecord = { transferId: string; sessionToken: string; expiresAt: string };
export async function saveRecovery(record: RecoveryRecord) {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "transferId" });
  await new Promise<void>((resolve, reject) => { request.onerror = () => reject(request.error); request.onsuccess = () => { const tx = request.result.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(record); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }; });
}
