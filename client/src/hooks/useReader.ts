import { useCallback, useEffect, useRef, useState } from "react";
import { deleteLibraryDocument, fetchExampleSimplifiedPdfBlob, inquire, simplifyPdf } from "../lib/api";
import { isMobileViewport } from "../lib/device";
import { ensureExamplePdfBlobs } from "../lib/examplePdf";
import { asPdfBlob, blobAsNamedFile, newId, pdfDownloadName } from "../lib/files";
import { idbDeletePdf, idbGetPdf, idbPutPdf } from "../lib/idb";
import {
  EXAMPLE_PDF_NAME,
  loadLibraryState,
  markExampleSeeded,
  saveLibraryState,
  wasExampleSeeded,
  type LibraryState,
} from "../lib/libraryStorage";
import type { PdfEntry, PdfView } from "../types";

export type InquireState = {
  open: boolean;
  segment: string;
  question: string;
  answer: string;
  submitting: boolean;
};

const SLOW_STATUS_MS = 30_000;
const EXAMPLE_SWITCH_MS = 3_000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

const CLOSED_INQUIRE: InquireState = {
  open: false,
  segment: "",
  question: "",
  answer: "",
  submitting: false,
};

function sanitize(state: LibraryState): LibraryState {
  let { selectedFolderId, selectedPdfId } = state;
  if (selectedPdfId && !state.library.pdfs.some((pdf) => pdf.id === selectedPdfId)) {
    selectedPdfId = null;
  }
  if (selectedFolderId && !state.library.folders.some((folder) => folder.id === selectedFolderId)) {
    selectedFolderId = state.library.folders[0]?.id ?? null;
  }
  return { library: state.library, selectedFolderId, selectedPdfId };
}

function readInitialState(): LibraryState {
  return sanitize(loadLibraryState());
}

export function useReader() {
  const [libraryState, setLibraryState] = useState<LibraryState>(readInitialState);
  const libraryStateRef = useRef(libraryState);
  libraryStateRef.current = libraryState;

  const [status, setStatus] = useState("Upload a PDF to begin.");
  const [originalPdfUrl, setOriginalPdfUrl] = useState<string | null>(null);
  const [simplifiedPdfUrl, setSimplifiedPdfUrl] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<PdfView>("original");
  const [simplifying, setSimplifying] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inquireState, setInquireState] = useState<InquireState>(CLOSED_INQUIRE);

  const urlsRef = useRef<{ original: string | null; simplified: string | null }>({
    original: null,
    simplified: null,
  });
  const selectedFileRef = useRef<Blob | null>(null);
  const currentViewRef = useRef<PdfView>("original");
  const inquireRef = useRef(inquireState);
  const bootedRef = useRef(false);

  currentViewRef.current = currentView;
  inquireRef.current = inquireState;

  const replaceUrl = useCallback((which: "original" | "simplified", next: string | null) => {
    const previous = urlsRef.current[which];
    if (previous) URL.revokeObjectURL(previous);
    urlsRef.current[which] = next;
    if (which === "original") setOriginalPdfUrl(next);
    else setSimplifiedPdfUrl(next);
  }, []);

  const commitLibrary = useCallback((next: LibraryState) => {
    const clean = sanitize(next);
    libraryStateRef.current = clean;
    setLibraryState(clean);
    saveLibraryState(clean);
  }, []);

  useEffect(() => {
    return () => {
      if (urlsRef.current.original) URL.revokeObjectURL(urlsRef.current.original);
      if (urlsRef.current.simplified) URL.revokeObjectURL(urlsRef.current.simplified);
    };
  }, []);

  const ensureFolderForUpload = useCallback((): string => {
    const current = libraryStateRef.current;
    if (current.library.folders.length === 0) {
      const id = newId();
      commitLibrary({
        library: {
          folders: [{ id, name: "Documents" }],
          pdfs: current.library.pdfs,
        },
        selectedFolderId: id,
        selectedPdfId: current.selectedPdfId,
      });
      return id;
    }
    if (
      !current.selectedFolderId ||
      !current.library.folders.some((folder) => folder.id === current.selectedFolderId)
    ) {
      const id = current.library.folders[0].id;
      commitLibrary({ ...current, selectedFolderId: id });
      return id;
    }
    return current.selectedFolderId;
  }, [commitLibrary]);

  const showPdfBlobs = useCallback(
    (original: Blob, simplified: Blob | null, displayName: string) => {
      const originalBlob = asPdfBlob(original);
      const simplifiedBlob = simplified ? asPdfBlob(simplified) : null;
      replaceUrl("original", URL.createObjectURL(originalBlob));
      replaceUrl("simplified", simplifiedBlob ? URL.createObjectURL(simplifiedBlob) : null);
      selectedFileRef.current = blobAsNamedFile(originalBlob, displayName);
      currentViewRef.current = "original";
      setCurrentView("original");
    },
    [replaceUrl],
  );

  const selectPdf = useCallback(
    async (pdfId: string) => {
      const pdf = libraryStateRef.current.library.pdfs.find((entry) => entry.id === pdfId);
      if (!pdf) return;
      commitLibrary({ ...libraryStateRef.current, selectedPdfId: pdfId });

      let blobs = pdf.displayName === EXAMPLE_PDF_NAME ? { original: null, simplified: null } : await idbGetPdf(pdfId);
      if (pdf.displayName === EXAMPLE_PDF_NAME) {
        try {
          setStatus("Loading example PDF…");
          blobs = await ensureExamplePdfBlobs(pdfId);
        } catch (error) {
          console.error(error);
          setStatus("PDF data missing; upload again.");
          return;
        }
      }
      if (!blobs.original) {
        setStatus("PDF data missing; upload again.");
        return;
      }

      showPdfBlobs(blobs.original, blobs.simplified, pdf.displayName);
      if (isMobileViewport()) setSidebarOpen(false);
    },
    [commitLibrary, showPdfBlobs],
  );

  const seedExamplePdfIfNeeded = useCallback(async (): Promise<boolean> => {
    const existingExample = libraryStateRef.current.library.pdfs.find(
      (pdf) => pdf.displayName === EXAMPLE_PDF_NAME,
    );
    if (existingExample) {
      try {
        markExampleSeeded();
        if (!libraryStateRef.current.selectedPdfId) {
          commitLibrary({ ...libraryStateRef.current, selectedPdfId: existingExample.id });
        }
        await selectPdf(libraryStateRef.current.selectedPdfId || existingExample.id);
        return true;
      } catch (error) {
        console.error(error);
        setStatus("Could not restore example PDF.");
        return false;
      }
    }

    if (wasExampleSeeded()) return false;
    if (libraryStateRef.current.library.pdfs.length > 0) {
      markExampleSeeded();
      return false;
    }

    let pdfId: string | null = null;
    try {
      setStatus("Loading example PDF…");
      const folderId = ensureFolderForUpload();
      pdfId = newId();
      const current = libraryStateRef.current;
      const entry: PdfEntry = {
        id: pdfId,
        folderId,
        displayName: EXAMPLE_PDF_NAME,
        storedStem: null,
      };
      commitLibrary({
        library: {
          folders: current.library.folders,
          pdfs: [...current.library.pdfs, entry],
        },
        selectedFolderId: folderId,
        selectedPdfId: pdfId,
      });
      const blobs = await ensureExamplePdfBlobs(pdfId);
      if (!blobs.original) throw new Error("Example PDF fetch failed");
      markExampleSeeded();
      showPdfBlobs(blobs.original, blobs.simplified, EXAMPLE_PDF_NAME);
      setStatus(
        blobs.simplified ? "Example PDF loaded." : "Example PDF loaded, but the simplified file was not found.",
      );
      return true;
    } catch (error) {
      console.error(error);
      if (pdfId) {
        const current = libraryStateRef.current;
        commitLibrary({
          ...current,
          library: {
            ...current.library,
            pdfs: current.library.pdfs.filter((pdf) => pdf.id !== pdfId),
          },
          selectedPdfId: current.selectedPdfId === pdfId ? null : current.selectedPdfId,
        });
        try {
          await idbDeletePdf(pdfId);
        } catch {
          /* The row is already gone from the library list. */
        }
      }
      const detail = error instanceof Error && error.message ? ` (${error.message})` : "";
      setStatus(`Could not load example PDF.${detail}`);
      return false;
    }
  }, [commitLibrary, ensureFolderForUpload, selectPdf, showPdfBlobs]);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    saveLibraryState(libraryStateRef.current);
    void (async () => {
      try {
        const seeded = await seedExamplePdfIfNeeded();
        if (!seeded && libraryStateRef.current.selectedPdfId) {
          await selectPdf(libraryStateRef.current.selectedPdfId);
        }
      } catch (error) {
        console.error(error);
      }
    })();
  }, [seedExamplePdfIfNeeded, selectPdf]);

  const addFolder = useCallback(() => {
    const entered = window.prompt("Folder name (e.g. Math, English):", "");
    if (entered == null) return;
    const name = entered.trim();
    if (!name) return;
    const current = libraryStateRef.current;
    const id = newId();
    commitLibrary({
      library: {
        folders: [...current.library.folders, { id, name }],
        pdfs: current.library.pdfs,
      },
      selectedFolderId: id,
      selectedPdfId: current.selectedPdfId,
    });
  }, [commitLibrary]);

  const selectFolder = useCallback(
    (folderId: string) => {
      commitLibrary({ ...libraryStateRef.current, selectedFolderId: folderId });
    },
    [commitLibrary],
  );

  const deleteFolder = useCallback(
    (folderId: string) => {
      const current = libraryStateRef.current;
      const folder = current.library.folders.find((entry) => entry.id === folderId);
      if (!folder) return;
      const count = current.library.pdfs.filter((pdf) => pdf.folderId === folderId).length;
      if (count > 0) {
        setStatus("Remove all PDFs from this folder before deleting it.");
        return;
      }
      if (!window.confirm(`Delete empty folder "${folder.name}"?`)) return;
      const folders = current.library.folders.filter((entry) => entry.id !== folderId);
      commitLibrary({
        library: { folders, pdfs: current.library.pdfs },
        selectedFolderId:
          current.selectedFolderId === folderId ? (folders[0]?.id ?? null) : current.selectedFolderId,
        selectedPdfId: current.selectedPdfId,
      });
      setStatus(`Folder "${folder.name}" removed.`);
    },
    [commitLibrary],
  );

  const deletePdf = useCallback(
    async (pdfId: string) => {
      const current = libraryStateRef.current;
      const pdf = current.library.pdfs.find((entry) => entry.id === pdfId);
      if (!pdf) return;
      const confirmed = window.confirm(
        `Delete "${pdf.displayName}" from the library? This removes local copies and server-side unparsed/parsed text (and matching Chroma chunks) when applicable.`,
      );
      if (!confirmed) return;

      if (pdf.storedStem) {
        try {
          await deleteLibraryDocument(pdf.storedStem);
        } catch (error) {
          console.error(error);
        }
      }

      await idbDeletePdf(pdfId);
      const latest = libraryStateRef.current;
      const wasSelected = latest.selectedPdfId === pdfId;
      commitLibrary({
        library: {
          folders: latest.library.folders,
          pdfs: latest.library.pdfs.filter((entry) => entry.id !== pdfId),
        },
        selectedFolderId: latest.selectedFolderId,
        selectedPdfId: wasSelected ? null : latest.selectedPdfId,
      });
      if (wasSelected) {
        replaceUrl("original", null);
        replaceUrl("simplified", null);
        selectedFileRef.current = null;
        currentViewRef.current = "original";
        setCurrentView("original");
        setStatus("PDF removed.");
      }
    },
    [commitLibrary, replaceUrl],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const folderId = ensureFolderForUpload();
      const pdfId = newId();
      const current = libraryStateRef.current;
      commitLibrary({
        library: {
          folders: current.library.folders,
          pdfs: [
            ...current.library.pdfs,
            { id: pdfId, folderId, displayName: file.name, storedStem: null },
          ],
        },
        selectedFolderId: folderId,
        selectedPdfId: pdfId,
      });

      try {
        await idbPutPdf(pdfId, file, null);
      } catch (error) {
        console.error(error);
        const latest = libraryStateRef.current;
        commitLibrary({
          ...latest,
          library: {
            ...latest.library,
            pdfs: latest.library.pdfs.filter((pdf) => pdf.id !== pdfId),
          },
          selectedPdfId: latest.selectedPdfId === pdfId ? null : latest.selectedPdfId,
        });
        setStatus("Could not save PDF locally (IndexedDB).");
        return;
      }

      selectedFileRef.current = file;
      replaceUrl("original", URL.createObjectURL(file));
      replaceUrl("simplified", null);
      currentViewRef.current = "original";
      setCurrentView("original");
      const folderName =
        libraryStateRef.current.library.folders.find((folder) => folder.id === folderId)?.name ||
        "folder";
      setStatus(`Original PDF loaded under "${folderName}".`);
      if (isMobileViewport()) setSidebarOpen(false);
    },
    [commitLibrary, ensureFolderForUpload, replaceUrl],
  );

  const simplify = useCallback(async () => {
    const file = selectedFileRef.current;
    if (!file) {
      setStatus("Please upload a PDF first.");
      return;
    }

    const targetPdfId = libraryStateRef.current.selectedPdfId;
    const selected = libraryStateRef.current.library.pdfs.find((pdf) => pdf.id === targetPdfId);
    if (selected?.displayName === EXAMPLE_PDF_NAME) {
      setSimplifying(true);
      setStatus("Uploading and simplifying…");
      try {
        if (!urlsRef.current.simplified) {
          const blob = await fetchExampleSimplifiedPdfBlob();
          replaceUrl("simplified", URL.createObjectURL(blob));
          if (targetPdfId) {
            const fromIdb = await idbGetPdf(targetPdfId);
            if (fromIdb.original) await idbPutPdf(targetPdfId, asPdfBlob(fromIdb.original), blob);
          }
        }
        await wait(EXAMPLE_SWITCH_MS);
        if (libraryStateRef.current.selectedPdfId !== targetPdfId) return;
        currentViewRef.current = "simplified";
        setCurrentView("simplified");
        setStatus("Simplified PDF ready.");
      } catch (error) {
        console.error(error);
        setStatus("Could not load the simplified example PDF.");
      } finally {
        setSimplifying(false);
      }
      return;
    }

    setSimplifying(true);
    setStatus("Uploading and simplifying…");
    const slowStatus = window.setTimeout(() => {
      setStatus("Simplifying… this may take up to 2 min.");
    }, SLOW_STATUS_MS);
    try {
      const { blob, stem } = await simplifyPdf(file);
      replaceUrl("simplified", URL.createObjectURL(blob));
      currentViewRef.current = "simplified";
      setCurrentView("simplified");
      setStatus("Simplified PDF ready.");

      if (targetPdfId && stem) {
        const current = libraryStateRef.current;
        commitLibrary({
          ...current,
          library: {
            ...current.library,
            pdfs: current.library.pdfs.map((pdf) =>
              pdf.id === targetPdfId ? { ...pdf, storedStem: stem } : pdf,
            ),
          },
        });
      }

      if (targetPdfId) {
        const fromIdb = await idbGetPdf(targetPdfId);
        if (fromIdb.original) {
          await idbPutPdf(targetPdfId, asPdfBlob(fromIdb.original), blob);
        } else {
          await idbPutPdf(targetPdfId, file, blob);
        }
      }
    } catch (error) {
      console.error(error);
      setStatus("Error simplifying PDF.");
    } finally {
      window.clearTimeout(slowStatus);
      setSimplifying(false);
    }
  }, [commitLibrary, replaceUrl]);

  const showOriginal = useCallback(() => {
    if (!urlsRef.current.original) return;
    currentViewRef.current = "original";
    setCurrentView("original");
  }, []);

  const showSimplified = useCallback(() => {
    if (!urlsRef.current.simplified) return;
    currentViewRef.current = "simplified";
    setCurrentView("simplified");
  }, []);

  const downloadCurrent = useCallback(() => {
    const view = currentViewRef.current;
    const url = view === "simplified" ? urlsRef.current.simplified : urlsRef.current.original;
    if (!url) return;

    const selected = libraryStateRef.current.library.pdfs.find(
      (pdf) => pdf.id === libraryStateRef.current.selectedPdfId,
    );
    const displayName =
      selected?.displayName ||
      (selectedFileRef.current instanceof File ? selectedFileRef.current.name : "document.pdf");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = pdfDownloadName(displayName, view);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, []);

  const openInquire = useCallback((segment: string) => {
    setInquireState({
      open: true,
      segment,
      question: "",
      answer: "",
      submitting: false,
    });
  }, []);

  const closeInquire = useCallback(() => {
    setInquireState(CLOSED_INQUIRE);
  }, []);

  const setQuestion = useCallback((question: string) => {
    setInquireState((current) => ({ ...current, question }));
  }, []);

  const submitInquire = useCallback(async () => {
    const { question, segment } = inquireRef.current;
    const trimmed = question.trim();
    if (!trimmed) {
      setInquireState((current) => ({ ...current, answer: "Please enter a question." }));
      return;
    }
    if (!segment) {
      setInquireState((current) => ({ ...current, answer: "No highlighted text." }));
      return;
    }

    setInquireState((current) => ({
      ...current,
      answer: "Loading...",
      submitting: true,
    }));
    const slowAnswer = window.setTimeout(() => {
      setInquireState((current) =>
        current.submitting ? { ...current, answer: "Loading...our CPU is trying it's best" } : current,
      );
    }, SLOW_STATUS_MS);
    try {
      const answer = await inquire(segment, trimmed);
      setInquireState((current) => ({ ...current, answer, submitting: false }));
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Could not reach the API. Is the server running?";
      setInquireState((current) => ({ ...current, answer: message, submitting: false }));
    } finally {
      window.clearTimeout(slowAnswer);
    }
  }, []);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);

  const handleRendering = useCallback(() => setStatus("Rendering PDF…"), []);
  const handleRenderError = useCallback(() => setStatus("Could not render PDF."), []);
  const handleRendered = useCallback(() => {
    setStatus(
      currentViewRef.current === "simplified"
        ? "Showing simplified PDF (select text to inquire)."
        : "Showing original PDF (select text to inquire).",
    );
  }, []);

  const pdfUrl = currentView === "simplified" ? simplifiedPdfUrl : originalPdfUrl;

  return {
    folders: libraryState.library.folders,
    pdfs: libraryState.library.pdfs,
    selectedFolderId: libraryState.selectedFolderId,
    selectedPdfId: libraryState.selectedPdfId,
    status,
    pdfUrl,
    currentView,
    simplifiedReady: simplifiedPdfUrl !== null,
    simplifying,
    sidebarOpen,
    inquireState,
    addFolder,
    selectFolder,
    selectPdf,
    deleteFolder,
    deletePdf,
    uploadFile,
    simplify,
    showOriginal,
    showSimplified,
    downloadCurrent,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    openInquire,
    closeInquire,
    setQuestion,
    submitInquire,
    handleRendering,
    handleRendered,
    handleRenderError,
  };
}
