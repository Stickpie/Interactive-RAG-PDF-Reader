import { fetchExamplePdfBlob, fetchExampleSimplifiedPdfBlob } from "./api";
import { idbGetPdf, idbPutPdf, type PdfBlobs } from "./idb";

// Always read the current files. IndexedDB is only a fallback if those files cannot be fetched.
export async function ensureExamplePdfBlobs(pdfId: string): Promise<PdfBlobs> {
  try {
    const [original, simplified] = await Promise.all([
      fetchExamplePdfBlob(),
      fetchExampleSimplifiedPdfBlob(),
    ]);
    try {
      await idbPutPdf(pdfId, original, simplified);
    } catch (error) {
      console.warn("IndexedDB save failed for example PDF; using in-memory copy.", error);
    }
    return { original, simplified };
  } catch (error) {
    try {
      const existing = await idbGetPdf(pdfId);
      if (existing.original) {
        console.warn("Using saved example PDF because the files could not be loaded.", error);
        return existing;
      }
    } catch (readError) {
      console.warn(readError);
    }
    throw error;
  }
}
