/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADOBE_CLIENT_ID?: string;
}

interface AdobeViewConfig {
  clientId: string;
  divId: string;
}

interface AdobePreviewConfig {
  embedMode?: "FULL_WINDOW" | "SIZED_CONTAINER" | "IN_LINE" | "LIGHT_BOX";
  defaultViewMode?: "FIT_PAGE" | "FIT_WIDTH";
  showDownloadPDF?: boolean;
  showPrintPDF?: boolean;
  showAnnotationTools?: boolean;
}

interface AdobeDCView {
  previewFile: (
    file: {
      content: { promise: Promise<ArrayBuffer> };
      metaData: { fileName: string };
    },
    config?: AdobePreviewConfig,
  ) => Promise<unknown>;
}

interface Window {
  __detectMobileEnv?: () => boolean;
  AdobeDC?: {
    View: new (config: AdobeViewConfig) => AdobeDCView;
  };
}
