import { fetchExamplePdfBlob, fetchExampleSimplifiedPdfBlob } from "./api";
import { idbGetPdf, idbPutPdf, type PdfBlobs } from "./idb";

const memory = new Map<string, PdfBlobs>();

async function readCached(pdfId: string): Promise<PdfBlobs> {
  const remembered = memory.get(pdfId);
  if (remembered?.original) return remembered;
  try {
    return await idbGetPdf(pdfId);
  } catch (error) {
    console.warn("Could not read the saved example PDF.", error);
    return { original: null, simplified: null };
  }
}

async function remember(pdfId: string, original: Blob, simplified: Blob | null) {
  const next = { original, simplified };
  memory.set(pdfId, next);
  try {
    await idbPutPdf(pdfId, original, simplified);
  } catch (error) {
    console.warn("Could not save the example PDF.", error);
  }
  return next;
}

export async function loadExampleDocuments(pdfId: string): Promise<PdfBlobs> {
  const cached = await readCached(pdfId);
  if (cached.original && cached.simplified) {
    memory.set(pdfId, cached);
    return cached;
  }
  if (cached.original) {
    memory.set(pdfId, cached);
    return cached;
  }

  const original = await fetchExamplePdfBlob();
  return remember(pdfId, original, cached.simplified);
}

export async function loadExampleSimplified(pdfId: string, original: Blob | null): Promise<Blob> {
  const cached = await readCached(pdfId);
  if (cached.simplified) {
    if (cached.original || original) memory.set(pdfId, { original: cached.original ?? original, simplified: cached.simplified });
    return cached.simplified;
  }

  const simplified = await fetchExampleSimplifiedPdfBlob();
  const base = cached.original ?? original;
  if (base) await remember(pdfId, base, simplified);
  return simplified;
}
