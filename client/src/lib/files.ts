export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function asPdfBlob(value: unknown): Blob {
  if (value instanceof Blob) return value;
  return new Blob([value as BlobPart], { type: "application/pdf" });
}

export function pdfDownloadName(displayName: string, view: "original" | "simplified"): string {
  const trimmed = displayName.trim() || "document.pdf";
  const withExt = /\.pdf$/i.test(trimmed) ? trimmed : `${trimmed}.pdf`;
  if (view === "original") return withExt;
  return withExt.replace(/\.pdf$/i, "-simplified.pdf");
}

export function blobAsNamedFile(blob: Blob, displayName: string): Blob {
  try {
    return new File([blob], displayName, { type: "application/pdf" });
  } catch {
    try {
      Object.defineProperty(blob, "name", { value: displayName });
    } catch {
      /* Some browsers lock the blob object. The bytes still upload. */
    }
    return blob;
  }
}
