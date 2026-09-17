import { toPng } from "html-to-image";
import { PDFDocument } from "pdf-lib";

const PAGE_WIDTH_PX = 816;
const PAGE_HEIGHT_PX = 1056;
const PAGE_WIDTH_PT = 612;
const PAGE_HEIGHT_PT = 792;

export async function buildTechnicalSeoReportPdf(report: HTMLElement): Promise<Uint8Array> {
  const pages = Array.from(report.querySelectorAll<HTMLElement>(".seo-report-page"));
  if (!pages.length || !report.isConnected) throw new Error("The report is not ready to download.");

  await document.fonts?.ready;
  await Promise.all(Array.from(report.querySelectorAll("img")).map(async (image) => {
    if (typeof image.decode === "function") await image.decode().catch(() => undefined);
    if (!image.complete || !image.naturalWidth) throw new Error("A report image could not be loaded.");
  }));

  const pdf = await PDFDocument.create();
  for (const page of pages) {
    const imageUrl = await toPng(page, {
      width: PAGE_WIDTH_PX,
      height: PAGE_HEIGHT_PX,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
      style: {
        width: `${PAGE_WIDTH_PX}px`,
        height: `${PAGE_HEIGHT_PX}px`,
        minHeight: `${PAGE_HEIGHT_PX}px`,
        margin: "0",
        boxShadow: "none",
        overflow: "hidden",
      },
    });
    const image = await pdf.embedPng(imageUrl);
    pdf.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT]).drawImage(image, {
      x: 0, y: 0, width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT,
    });
  }
  return pdf.save();
}

export async function downloadTechnicalSeoReportPdf(report: HTMLElement, filename: string): Promise<void> {
  const bytes = await buildTechnicalSeoReportPdf(report);
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
