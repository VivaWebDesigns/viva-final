import { toBlob } from "html-to-image";
import {
  LOCAL_VISIBILITY_REPORT_HEIGHT,
  LOCAL_VISIBILITY_REPORT_WIDTH,
} from "./types";

export async function renderLocalVisibilityReportBlob(element: HTMLDivElement | null): Promise<Blob> {
  if (!element) throw new Error("The report preview is not ready.");
  await document.fonts?.ready;
  const blob = await toBlob(element, {
    width: LOCAL_VISIBILITY_REPORT_WIDTH,
    height: LOCAL_VISIBILITY_REPORT_HEIGHT,
    canvasWidth: LOCAL_VISIBILITY_REPORT_WIDTH,
    canvasHeight: LOCAL_VISIBILITY_REPORT_HEIGHT,
    pixelRatio: 1,
    backgroundColor: "#ffffff",
    cacheBust: true,
  });
  if (!blob) throw new Error("The report image could not be created.");
  return blob;
}
