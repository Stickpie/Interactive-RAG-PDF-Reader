import type { RefObject } from "react";
import type { PdfView } from "../types";

type ToolbarProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  currentView: PdfView;
  simplifiedReady: boolean;
  simplifying: boolean;
  onFile: (file: File) => void;
  onSimplify: () => void;
  onShowOriginal: () => void;
  onShowSimplified: () => void;
};

export function Toolbar({
  fileInputRef,
  currentView,
  simplifiedReady,
  simplifying,
  onFile,
  onSimplify,
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
