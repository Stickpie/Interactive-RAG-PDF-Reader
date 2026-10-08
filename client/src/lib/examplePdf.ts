import { fetchExamplePdfBlob } from "./api";
import { idbGetPdf, idbPutPdf, type PdfBlobs } from "./idb";

export async function ensureExamplePdfBlobs(pdfId: string): Promise<PdfBlobs> {
  try {
    const existing = await idbGetPdf(pdfId);
    if (existing.original) return existing;
  } catch (error) {
    console.warn(error);
  }

  const original = await fetchExamplePdfBlob();
  try {
    await idbPutPdf(pdfId, original, null);
  } catch (error) {
    console.warn("IndexedDB save failed for example PDF; using in-memory copy.", error);
  }
  return { original, simplified: null };
}
