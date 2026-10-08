import { useEffect, useLayoutEffect, useRef } from "react";
import { InquireDialog } from "./components/InquireDialog";
import { PdfViewer } from "./components/PdfViewer";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { deviceKind } from "./lib/device";
import { useReader } from "./hooks/useReader";
import { useViewport } from "./hooks/useViewport";

export function App() {
  const reader = useReader();
  const { kind, tick } = useViewport();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("is-mobile-env", kind === "mobile");
    document.body.classList.remove("is-mobile", "is-tablet", "is-desktop");
    document.body.classList.add(kind === "mobile" ? "is-mobile" : kind === "tablet" ? "is-tablet" : "is-desktop");
    document.body.classList.toggle("sidebar-open", reader.sidebarOpen);
  }, [kind, reader.sidebarOpen]);

  useEffect(() => {
    if (kind !== "mobile") reader.closeSidebar();
  }, [kind, reader.closeSidebar]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (reader.inquireState.open) {
        reader.closeInquire();
      } else if (deviceKind() === "mobile" && reader.sidebarOpen) {
        reader.closeSidebar();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [reader.inquireState.open, reader.sidebarOpen, reader.closeInquire, reader.closeSidebar]);

  const openFilePicker = () => fileInputRef.current?.click();

  return (
    <>
      <header className="mobile-header">
        <button
          type="button"
          id="sidebarToggle"
          className="sidebar-toggle"
          aria-label="Open library"
          aria-expanded={reader.sidebarOpen}
          onClick={reader.toggleSidebar}
        >
          <span className="hamburger" aria-hidden="true" />
        </button>
        <span className="mobile-title">PDF Simplifier</span>
        <button
          type="button"
          id="mobileNewDocBtn"
          className="mobile-new-doc-btn"
          aria-label="Upload new document"
          onClick={openFilePicker}
        >
          +
        </button>
      </header>

      <div
        className="sidebar-backdrop"
        id="sidebarBackdrop"
        aria-hidden={reader.sidebarOpen ? "false" : "true"}
        onClick={reader.closeSidebar}
      />

      <div className="app-shell">
        <Sidebar
          folders={reader.folders}
          pdfs={reader.pdfs}
          selectedFolderId={reader.selectedFolderId}
          selectedPdfId={reader.selectedPdfId}
          onAddFolder={reader.addFolder}
          onSelectFolder={reader.selectFolder}
          onDeleteFolder={reader.deleteFolder}
          onSelectPdf={(pdfId) => {
            void reader.selectPdf(pdfId);
          }}
          onDeletePdf={reader.deletePdf}
          onUpload={() => {
            reader.closeSidebar();
            openFilePicker();
          }}
          onClose={reader.closeSidebar}
        />

        <div className="main-area">
          <h1>PDF Simplifier</h1>
          <Toolbar
            fileInputRef={fileInputRef}
            currentView={reader.currentView}
            simplifiedReady={reader.simplifiedReady}
            simplifying={reader.simplifying}
            onFile={(file) => {
              void reader.uploadFile(file);
            }}
            onSimplify={() => {
              void reader.simplify();
            }}
            onShowOriginal={reader.showOriginal}
            onShowSimplified={reader.showSimplified}
          />
          <div className="status" id="status" aria-live="polite">
            {reader.status}
          </div>
          <PdfViewer
            url={reader.pdfUrl}
            layoutTick={tick}
            onRendering={reader.handleRendering}
            onRendered={reader.handleRendered}
            onRenderError={reader.handleRenderError}
            onTextSelect={reader.openInquire}
          />
          <p className="mobile-hint">Tap text to ask AI query…</p>
        </div>
      </div>

      <InquireDialog
        inquire={reader.inquireState}
        onQuestionChange={reader.setQuestion}
        onClose={reader.closeInquire}
        onSubmit={() => {
          void reader.submitInquire();
        }}
      />
    </>
  );
}
