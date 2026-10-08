export type DeviceKind = "mobile" | "tablet" | "desktop";

export const MOBILE_LAYOUT_MQ = window.matchMedia("(max-width: 768px)");
export const MOBILE_DEVICE_MQ = window.matchMedia("(max-device-width: 768px)");
export const TOUCH_MQ = window.matchMedia("(hover: none) and (pointer: coarse)");
export const TABLET_MQ = window.matchMedia("(max-width: 1024px)");

export function isMobileViewport(): boolean {
  if (typeof window.__detectMobileEnv === "function") {
    return window.__detectMobileEnv();
  }
  return (
    MOBILE_LAYOUT_MQ.matches ||
    MOBILE_DEVICE_MQ.matches ||
    (TOUCH_MQ.matches && Math.min(window.screen.width, window.screen.height) <= 1024)
  );
}

export function isTabletViewport(): boolean {
  return TABLET_MQ.matches && !isMobileViewport();
}

export function deviceKind(): DeviceKind {
  if (isMobileViewport()) return "mobile";
  if (TABLET_MQ.matches) return "tablet";
  return "desktop";
}
