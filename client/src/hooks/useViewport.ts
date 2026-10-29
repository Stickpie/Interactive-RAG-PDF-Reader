import { useEffect, useState } from "react";
import {
  deviceKind,
  MOBILE_DEVICE_MQ,
  MOBILE_LAYOUT_MQ,
  TABLET_MQ,
  TOUCH_MQ,
  type DeviceKind,
} from "../lib/device";

export function useViewport(): DeviceKind {
  const [kind, setKind] = useState<DeviceKind>(() => deviceKind());

  useEffect(() => {
    let timer = 0;
    const apply = () => setKind(deviceKind());
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(apply, 200);
    };

    const queries = [MOBILE_LAYOUT_MQ, MOBILE_DEVICE_MQ, TOUCH_MQ, TABLET_MQ];
    window.addEventListener("resize", onResize);
    queries.forEach((query) => query.addEventListener("change", apply));
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      queries.forEach((query) => query.removeEventListener("change", apply));
    };
  }, []);

  return kind;
}
