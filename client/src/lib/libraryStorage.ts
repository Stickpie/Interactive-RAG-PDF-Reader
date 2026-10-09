import type { Folder, Library, PdfEntry } from "../types";

export const EXAMPLE_PDF_NAME = "ExamplePDF.pdf";

const LS_LIBRARY_KEY = "pdfSimplifierLibraryV1";
const LS_EXAMPLE_SEEDED_KEY = "pdfSimplifierExampleSeededV1";

export type LibraryState = {
  library: Library;
  selectedFolderId: string | null;
  selectedPdfId: string | null;
};

const EMPTY_STATE: LibraryState = {
  library: { folders: [], pdfs: [] },
  selectedFolderId: null,
  selectedPdfId: null,
};

function isFolder(value: unknown): value is Folder {
  if (!value || typeof value !== "object") return false;
  const folder = value as Folder;
  return typeof folder.id === "string" && typeof folder.name === "string";
}

function isPdfEntry(value: unknown): value is PdfEntry {
  if (!value || typeof value !== "object") return false;
  const pdf = value as PdfEntry;
  return typeof pdf.id === "string" && typeof pdf.folderId === "string" && typeof pdf.displayName === "string";
}

export function loadLibraryState(): LibraryState {
  try {
    const raw = localStorage.getItem(LS_LIBRARY_KEY);
    if (!raw) return EMPTY_STATE;
    const data = JSON.parse(raw) as {
      folders?: unknown;
      pdfs?: unknown;
      selectedFolderId?: unknown;
      selectedPdfId?: unknown;
    };
    return {
      library: {
        folders: Array.isArray(data.folders) ? data.folders.filter(isFolder) : [],
        pdfs: Array.isArray(data.pdfs)
          ? data.pdfs.filter(isPdfEntry).map((pdf) => ({
              ...pdf,
              storedStem: typeof pdf.storedStem === "string" ? pdf.storedStem : null,
            }))
          : [],
      },
      selectedFolderId: typeof data.selectedFolderId === "string" ? data.selectedFolderId : null,
      selectedPdfId: typeof data.selectedPdfId === "string" ? data.selectedPdfId : null,
    };
  } catch (error) {
    console.warn(error);
    return EMPTY_STATE;
  }
}

export function saveLibraryState(state: LibraryState): void {
  localStorage.setItem(
    LS_LIBRARY_KEY,
    JSON.stringify({
      folders: state.library.folders,
      pdfs: state.library.pdfs,
      selectedFolderId: state.selectedFolderId,
      selectedPdfId: state.selectedPdfId,
    }),
  );
}

export function wasExampleSeeded(): boolean {
  return localStorage.getItem(LS_EXAMPLE_SEEDED_KEY) === "1";
}

export function markExampleSeeded(): void {
  localStorage.setItem(LS_EXAMPLE_SEEDED_KEY, "1");
}
