import type { RefObject } from "react";
import type { PdfView } from "../types";

type ToolbarProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  currentView: PdfView;
  simplifiedReady: boolean;
  simplifying: boolean;
  canDownload: boolean;
  onFile: (file: File) => void;
  onSimplify: () => void;
  onDownload: () => void;
  onShowOriginal: () => void;
  onShowSimplified: () => void;
};

export function Toolbar({
  fileInputRef,
  currentView,
  simplifiedReady,
  simplifying,
  canDownload,
  onFile,
  onSimplify,
  onDownload,
  onShowOriginal,
  onShowSimplified,
}: ToolbarProps) {
  return (
    <div className="toolbar-wrap">
      <div className="file-actions">
        <input
          ref={fileInputRef}
          type="file"
          id="pdfInput"
          className="file-input-native"
          accept="application/pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onFile(file);
          }}
        />
        <label htmlFor="pdfInput" className="file-choose-btn">
          Choose File
        </label>
        <button type="button" id="simplifyBtn" disabled={simplifying} onClick={onSimplify}>
          <span className="btn-label-full">{simplifying ? "Simplifying…" : "Simplify PDF"}</span>
          <span className="btn-label-short">{simplifying ? "Simplifying…" : "Simplify"}</span>
        </button>
        <button
          type="button"
          className="download-pdf-btn"
          aria-label={currentView === "simplified" ? "Download simplified PDF" : "Download original PDF"}
          title={currentView === "simplified" ? "Download simplified PDF" : "Download original PDF"}
          disabled={!canDownload}
          onClick={onDownload}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 5v14M5 12l7 7 7-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <nav className="view-segment" aria-label="PDF view mode">
        <button
          type="button"
          id="showOriginalBtn"
          className={currentView === "original" ? "active" : undefined}
          onClick={onShowOriginal}
        >
          Original
        </button>
        <button
          type="button"
          id="showSimplifiedBtn"
          className={currentView === "simplified" ? "active" : undefined}
          disabled={!simplifiedReady}
          onClick={onShowSimplified}
        >
          Simplified
        </button>
      </nav>
    </div>
  );
}
