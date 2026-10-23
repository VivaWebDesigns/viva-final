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

/** Re-encodes an image blob. Snapshots are stored as JPEG, but the clipboard only accepts PNG. */
export async function convertImageBlob(blob: Blob, type: "image/png" | "image/jpeg", quality = 0.82): Promise<Blob> {
  if (blob.type === type) return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The image could not be converted.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((converted) => converted ? resolve(converted) : reject(new Error("The image could not be converted.")), type, quality);
  });
}
