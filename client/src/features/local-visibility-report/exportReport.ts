import { toBlob } from "html-to-image";
import {
  LOCAL_VISIBILITY_REPORT_LEGACY_HEIGHT,
  LOCAL_VISIBILITY_REPORT_WIDTH,
} from "./types";

export async function renderLocalVisibilityReportBlob(element: HTMLDivElement | null): Promise<Blob> {
  if (!element) throw new Error("The report preview is not ready.");
  if (!element.isConnected) throw new Error("The report preview was closed before the image finished rendering.");
  const exportHeight = Number(element.dataset.exportHeight) || LOCAL_VISIBILITY_REPORT_LEGACY_HEIGHT;
  await document.fonts?.ready;
  await Promise.all(Array.from(element.querySelectorAll("img")).map(async (image) => {
    if (typeof image.decode !== "function") return;
    await image.decode().catch(() => undefined);
    if (!image.naturalWidth) throw new Error("A report image could not be loaded.");
  }));
  const blob = await toBlob(element, {
    width: LOCAL_VISIBILITY_REPORT_WIDTH,
    height: exportHeight,
    canvasWidth: LOCAL_VISIBILITY_REPORT_WIDTH,
    canvasHeight: exportHeight,
    pixelRatio: 1,
    backgroundColor: "#ffffff",
    cacheBust: true,
  });
  if (!blob) throw new Error("The report image could not be created.");
  return blob;
}
