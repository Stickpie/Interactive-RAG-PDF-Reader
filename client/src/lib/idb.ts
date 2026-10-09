const IDB_NAME = "pdfSimplifierIDB";
const IDB_STORE = "pdfBlobs";

export type PdfBlobs = {
  original: Blob | null;
  simplified: Blob | null;
};

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbPutPdf(
  pdfId: string,
  originalBlob: Blob,
  simplifiedBlob: Blob | null,
): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IDB_STORE).put(
      { original: originalBlob, simplified: simplifiedBlob ?? null },
      pdfId,
    );
  });
  db.close();
}

export async function idbGetPdf(pdfId: string): Promise<PdfBlobs> {
  const db = await openIdb();
  const record = await new Promise<PdfBlobs | undefined>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const request = tx.objectStore(IDB_STORE).get(pdfId);
    request.onsuccess = () => resolve(request.result as PdfBlobs | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return record ?? { original: null, simplified: null };
}

export async function idbDeletePdf(pdfId: string): Promise<void> {
  const db = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IDB_STORE).delete(pdfId);
  });
  db.close();
}
