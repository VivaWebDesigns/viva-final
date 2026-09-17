import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { toPng } from "html-to-image";
import { buildTechnicalSeoReportPdf } from "../../client/src/features/technical-seo/exportReportPdf";

vi.mock("html-to-image", () => ({ toPng: vi.fn() }));

describe("technical SEO PDF export", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.mocked(toPng).mockReset();
  });

  it("downloads the four report sections as four letter-sized PDF pages", async () => {
    const png = await sharp({ create: { width: 1, height: 1, channels: 4, background: "#ffffff" } }).png().toBuffer();
    vi.mocked(toPng).mockResolvedValue(`data:image/png;base64,${png.toString("base64")}`);
    const report = document.createElement("main");
    report.innerHTML = Array.from({ length: 4 }, (_, index) => `<section class="seo-report-page">Page ${index + 1}</section>`).join("");
    document.body.appendChild(report);

    const pdf = await PDFDocument.load(await buildTechnicalSeoReportPdf(report));

    expect(pdf.getPageCount()).toBe(4);
    expect(pdf.getPages().map((page) => page.getSize())).toEqual(Array.from({ length: 4 }, () => ({ width: 612, height: 792 })));
    expect(toPng).toHaveBeenCalledTimes(4);
    expect(vi.mocked(toPng).mock.calls[0][1]).toMatchObject({ width: 816, height: 1056, pixelRatio: 2, style: { width: "816px", height: "1056px" } });
  });

  it("does not create an empty PDF when the report is missing", async () => {
    const report = document.createElement("main");
    await expect(buildTechnicalSeoReportPdf(report)).rejects.toThrow("not ready");
  });
});
