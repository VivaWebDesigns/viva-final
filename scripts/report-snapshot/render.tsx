// Renders the CRM's 1080×1920 report template in headless Chromium so
// import:competitors produces the same image as the Import window.
import { createRoot } from "react-dom/client";
import LocalVisibilityReportTemplate from "@/features/local-visibility-report/LocalVisibilityReportTemplate";
import { renderLocalVisibilityReportBlob } from "@/features/local-visibility-report/exportReport";
import type { LocalVisibilityReportData } from "@/features/local-visibility-report/types";

type MapPresentation = { mapZoom: number; mapPosition: { x: number; y: number } };

declare global {
  interface Window {
    renderReport: (data: LocalVisibilityReportData, map: MapPresentation) => Promise<string>;
  }
}

const root = createRoot(document.getElementById("root")!);

window.renderReport = async (data, map) => {
  const element = await new Promise<HTMLDivElement>((resolve) => {
    root.render(
      <LocalVisibilityReportTemplate
        ref={(node) => { if (node) resolve(node); }}
        data={data}
        mapZoom={map.mapZoom}
        mapPosition={map.mapPosition}
      />,
    );
  });
  const blob = await renderLocalVisibilityReportBlob(element);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};
