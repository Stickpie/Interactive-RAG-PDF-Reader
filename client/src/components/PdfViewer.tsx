import { useEffect, useRef } from "react";
import { isMobileViewport, isTabletViewport } from "../lib/device";
import pdfjsLib from "../pdfSetup";

type PdfViewerProps = {
  url: string | null;
  layoutTick: number;
  onRendering: () => void;
  onRendered: () => void;
  onRenderError: () => void;
  onTextSelect: (text: string) => void;
};

function renderTextLayerFallback(
  items: Array<{ str?: string; transform?: number[] } | { type?: string }>,
  container: HTMLElement,
  viewportTransform: number[],
) {
  for (const item of items) {
    if (!("str" in item) || !item.str || !item.str.trim() || !item.transform) continue;
    const tx = pdfjsLib.Util.transform(viewportTransform, item.transform);
    const span = document.createElement("span");
    span.textContent = item.str;
    span.style.left = `${tx[4]}px`;
    span.style.top = `${tx[5]}px`;
    const fontHeight = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
    span.style.fontSize = `${fontHeight}px`;
    container.appendChild(span);
  }
}

export function PdfViewer({
  url,
  layoutTick,
  onRendering,
  onRendered,
  onRenderError,
  onTextSelect,
}: PdfViewerProps) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onRendering, onRendered, onRenderError, onTextSelect });
  callbacksRef.current = { onRendering, onRendered, onRenderError, onTextSelect };

  useEffect(() => {
    const container = pagesRef.current;
    if (!container) return;
    if (!url) {
      container.innerHTML = "";
      return;
    }

    let cancelled = false;

    const render = async () => {
      callbacksRef.current.onRendering();
      container.innerHTML = "";
      try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        if (cancelled) return;
        const firstPage = await pdf.getPage(1);
        if (cancelled) return;

        const viewportAt1 = firstPage.getViewport({ scale: 1 });
        const horizontalPadding = isMobileViewport() ? 32 : 36;
        const maxWidth = Math.max(container.clientWidth - horizontalPadding, 280);
        const fitScale = maxWidth / viewportAt1.width;
        const scale = isMobileViewport()
          ? fitScale
          : Math.min(isTabletViewport() ? 1.1 : 1.25, fitScale);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = pageNumber === 1 ? firstPage : await pdf.getPage(pageNumber);
          if (cancelled) return;
          const viewport = page.getViewport({ scale });
          const wrap = document.createElement("div");
          wrap.className = "pdf-page";
          wrap.style.width = `${viewport.width}px`;
          wrap.style.maxWidth = "100%";

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Could not get a canvas drawing context.");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: context, viewport }).promise;
          if (cancelled) return;

          const textLayerDiv = document.createElement("div");
          textLayerDiv.className = "textLayer";
          const textContent = await page.getTextContent();
          if (cancelled) return;

          try {
            const textLayer = pdfjsLib.renderTextLayer({
              textContentSource: textContent,
              container: textLayerDiv,
              viewport,
              textDivs: [],
            });
            await textLayer.promise;
          } catch (error) {
            if (cancelled) return;
            console.warn("renderTextLayer failed, using fallback", error);
            textLayerDiv.innerHTML = "";
            renderTextLayerFallback(textContent.items, textLayerDiv, viewport.transform);
          }

          wrap.appendChild(canvas);
          wrap.appendChild(textLayerDiv);
          container.appendChild(wrap);
        }

        if (!cancelled) callbacksRef.current.onRendered();
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        callbacksRef.current.onRenderError();
      }
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [url, layoutTick]);

  const readSelection = () => {
    const text = window.getSelection()?.toString().trim() ?? "";
    if (text.length > 0) callbacksRef.current.onTextSelect(text);
  };

  return (
    <div
      id="pdf-pages"
      ref={pagesRef}
      aria-label="PDF pages"
      onMouseUp={readSelection}
      onTouchEnd={() => {
        window.setTimeout(readSelection, 50);
      }}
    />
  );
}
