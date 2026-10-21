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

type PdfTextItem = {
  str?: string;
  dir?: string;
  transform?: number[];
  width?: number;
  height?: number;
  fontName?: string;
  hasEOL?: boolean;
  type?: string;
};

type PdfTextStyle = {
  fontFamily?: string;
  vertical?: boolean;
};

type PdfTextContent = {
  items: PdfTextItem[];
  styles?: Record<string, PdfTextStyle>;
};

const DEFAULT_FONT_ASCENT = 0.8;
const ascentCache = new Map<string, number>();

function fontAscentRatio(fontFamily: string, ctx: CanvasRenderingContext2D | null): number {
  const cached = ascentCache.get(fontFamily);
  if (cached) return cached;
  if (!ctx) return DEFAULT_FONT_ASCENT;

  ctx.font = `30px ${fontFamily}`;
  const metrics = ctx.measureText("Hg");
  const ascent = metrics.fontBoundingBoxAscent;
  const descent = Math.abs(metrics.fontBoundingBoxDescent ?? 0);
  const ratio = ascent > 0 && ascent + descent > 0 ? ascent / (ascent + descent) : DEFAULT_FONT_ASCENT;
  ascentCache.set(fontFamily, ratio);
  return ratio;
}

function renderTextLayerFallback(
  textContent: PdfTextContent,
  container: HTMLElement,
  viewport: { width: number; height: number; scale: number; transform: number[] },
) {
  container.style.width = `${viewport.width}px`;
  container.style.height = `${viewport.height}px`;
  const styles = textContent.styles ?? {};
  const measure = document.createElement("canvas").getContext("2d");
  const pixelRatio = window.devicePixelRatio || 1;

  for (const item of textContent.items) {
    if (typeof item.str !== "string" || !item.transform) continue;
    const style = styles[item.fontName ?? ""] ?? {};
    const fontFamily = style.fontFamily || "sans-serif";
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    let angle = Math.atan2(tx[1], tx[0]);
    if (style.vertical) angle += Math.PI / 2;

    const fontHeight = Math.hypot(tx[2], tx[3]);
    const ascent = fontHeight * fontAscentRatio(fontFamily, measure);
    const left = angle === 0 ? tx[4] : tx[4] + ascent * Math.sin(angle);
    const top = angle === 0 ? tx[5] - ascent : tx[5] - ascent * Math.cos(angle);

    if (item.str !== "") {
      const span = document.createElement("span");
      span.textContent = item.str;
      span.setAttribute("role", "presentation");
      if (item.dir) span.dir = item.dir;
      span.style.left = `${left}px`;
      span.style.top = `${top}px`;
      span.style.fontSize = `${fontHeight}px`;
      span.style.fontFamily = fontFamily;

      const pdfWidth = style.vertical ? item.height : item.width;
      let transform = "";
      if (item.str.length > 1 && pdfWidth && pdfWidth > 0 && measure) {
        measure.font = `${fontHeight * pixelRatio}px ${fontFamily}`;
        const measured = measure.measureText(item.str).width;
        if (measured > 0) transform = `scaleX(${(pdfWidth * viewport.scale * pixelRatio) / measured})`;
      }
      if (angle !== 0) transform = `rotate(${(angle * 180) / Math.PI}deg) ${transform}`.trim();
      if (transform) span.style.transform = transform;
      container.append(span);
    }

    if (item.hasEOL) {
      const lineBreak = document.createElement("br");
      lineBreak.setAttribute("role", "presentation");
      container.append(lineBreak);
    }
  }
}

function finishTextLayer(textLayer: HTMLElement) {
  const end = document.createElement("div");
  end.className = "endOfContent";
  textLayer.append(end);
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

        const outputScale = window.devicePixelRatio || 1;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = pageNumber === 1 ? firstPage : await pdf.getPage(pageNumber);
          if (cancelled) return;
          const viewport = page.getViewport({ scale });
          const wrap = document.createElement("div");
          wrap.className = "pdf-page";
          wrap.style.width = `${viewport.width}px`;
          wrap.style.height = `${viewport.height}px`;

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Could not get a canvas drawing context.");
          canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
          canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          const renderTask = page.render({
            canvasContext: context,
            viewport,
            ...(outputScale === 1 ? {} : { transform: [outputScale, 0, 0, outputScale, 0, 0] }),
          });
          await renderTask.promise;
          if (cancelled) return;

          const textLayerDiv = document.createElement("div");
          textLayerDiv.className = "textLayer";
          textLayerDiv.style.setProperty("--scale-factor", String(viewport.scale));
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
            if (cancelled) return;
          } catch (error) {
            if (cancelled) return;
            console.warn("renderTextLayer failed, using fallback", error);
            textLayerDiv.replaceChildren();
            renderTextLayerFallback(textContent, textLayerDiv, viewport);
          }

          finishTextLayer(textLayerDiv);
          wrap.append(canvas, textLayerDiv);
          container.append(wrap);
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
