const ADOBE_VIEWER_SRC = "https://acrobatservices.adobe.com/view-sdk/viewer.js";

let ready: Promise<void> | null = null;

export function loadAdobePdfEmbed(): Promise<void> {
  if (window.AdobeDC) return Promise.resolve();
  if (ready) return ready;

  ready = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.AdobeDC) resolve();
      else reject(new Error("Adobe PDF Embed API loaded without AdobeDC."));
    };

    if (window.AdobeDC) {
      finish();
      return;
    }

    document.addEventListener("adobe_dc_view_sdk.ready", finish, { once: true });

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${ADOBE_VIEWER_SRC}"]`);
    if (existing) return;

    const script = document.createElement("script");
    script.src = ADOBE_VIEWER_SRC;
    script.async = true;
    script.onerror = () => {
      ready = null;
      reject(new Error("Could not load the Adobe PDF Embed API."));
    };
    document.head.appendChild(script);
  });

  return ready;
}
