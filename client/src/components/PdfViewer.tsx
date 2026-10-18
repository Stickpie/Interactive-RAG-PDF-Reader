import { useEffect, useRef } from "react";
import { loadAdobePdfEmbed } from "../lib/adobeViewer";

const ADOBE_VIEW_ID = "pdf-pages";

type PdfViewerProps = {
  url: string | null;
  fileName: string;
  onRendering: () => void;
  onRendered: () => void;
  onRenderError: (message?: string) => void;
};

export function PdfViewer({ url, fileName, onRendering, onRendered, onRenderError }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onRendering, onRendered, onRenderError });
  callbacksRef.current = { onRendering, onRendered, onRenderError };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.replaceChildren();
    if (!url) return;

    let cancelled = false;

    const render = async () => {
      callbacksRef.current.onRendering();
      const clientId = import.meta.env.VITE_ADOBE_CLIENT_ID?.trim();
      if (!clientId) {
        throw new Error("Add VITE_ADOBE_CLIENT_ID to client/.env to load the Adobe PDF viewer.");
      }

      await loadAdobePdfEmbed();
      if (cancelled || !window.AdobeDC) return;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not read the PDF.");
      const buffer = await response.arrayBuffer();
      if (cancelled) return;

      const view = new window.AdobeDC.View({ clientId, divId: ADOBE_VIEW_ID });
      await view.previewFile(
        {
          content: { promise: Promise.resolve(buffer) },
          metaData: { fileName },
        },
        {
          embedMode: "FULL_WINDOW",
          defaultViewMode: "FIT_WIDTH",
          showDownloadPDF: false,
          showPrintPDF: false,
          showAnnotationTools: false,
        },
      );
      if (cancelled) {
        container.replaceChildren();
        return;
      }
      callbacksRef.current.onRendered();
    };

    render().catch((error: unknown) => {
      if (cancelled) return;
      console.error(error);
      const message = error instanceof Error ? error.message : "Could not render PDF.";
      callbacksRef.current.onRenderError(message);
    });

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [url, fileName]);

  return <div id={ADOBE_VIEW_ID} ref={containerRef} aria-label="PDF pages" />;
}
