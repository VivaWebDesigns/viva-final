import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { z } from "zod";

export const visibilityFieldNames = [
  "businessName",
  "address",
  "rating",
  "reviewCount",
  "searchPhrase",
  "market",
  "averagePosition",
  "gridSize",
  "radius",
] as const;

const nullableText = z.string().nullable();

const visibilityScreenshotExtractionSchema = z.object({
  reportImageIndex: z.number().int().min(-1).max(1),
  heatmapImageIndex: z.number().int().min(-1).max(1),
  fields: z.object({
    businessName: nullableText,
    address: nullableText,
    rating: nullableText,
    reviewCount: nullableText,
    searchPhrase: nullableText,
    market: nullableText,
    averagePosition: nullableText,
    gridSize: nullableText,
    radius: nullableText,
  }),
  lowConfidenceFields: z.array(z.enum(visibilityFieldNames)),
});

export const visibilityScreenshotAnalysisSchema = visibilityScreenshotExtractionSchema.extend({
  heatmapImageDataUrl: z.string().nullable(),
});

export type VisibilityScreenshotAnalysis = z.infer<typeof visibilityScreenshotAnalysisSchema>;
export type VisibilityScreenshotExtraction = z.infer<typeof visibilityScreenshotExtractionSchema>;

type ScreenshotInput = {
  buffer: Buffer;
  mimeType: string;
};

let ocrQueue: Promise<unknown> = Promise.resolve();

const EXTRACTION_INSTRUCTIONS = `You extract Local Falcon scan data for a local SEO report generator.

You will receive exactly two numbered screenshots. One is normally a compact "Scan Report" summary and the other is the ranking heatmap. Identify their zero-based image indexes and extract fields only from visible evidence.

Rules:
- averagePosition must come from ARP (Average Rank Position). Never use ATRP or SoLV.
- Preserve every visible ARP decimal digit exactly; for example, return 3.08 as "3.08", never "3.0".
- Ignore square-mile coverage entirely.
- gridSize must use the format "N × N".
- radius must contain only the numeric mile value, with no unit.
- rating must contain only the numeric rating.
- reviewCount must contain only the integer count.
- Infer market as "City, ST" only when the address visibly supports it.
- Use null when a value is not visible or cannot be inferred safely.
- Put any field that may be misread or inferred weakly in lowConfidenceFields.
- If an image type cannot be identified, use -1 for that image index.`;

function toDataUrl(input: ScreenshotInput): string {
  return `data:${input.mimeType};base64,${input.buffer.toString("base64")}`;
}

function safetyIdentifier(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 32);
}

function cleanOcrLine(value: string): string {
  return value.replace(/[|]/g, "I").replace(/\s+/g, " ").trim();
}

function matchValue(text: string, pattern: RegExp): string | null {
  return text.match(pattern)?.[1]?.trim() || null;
}

function normalizeAveragePosition(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric > 0 && numeric <= 30 ? normalized : null;
}

function extractLabeledArp(text: string): string | null {
  return normalizeAveragePosition(matchValue(
    text,
    /(?:^|\s)ARP\b[^0-9]{0,14}([0-9]{1,2}(?:\s*[.,]\s*[0-9](?:\s*[0-9])?)?)\b/i,
  ));
}

function sanitizeExtraction(extraction: VisibilityScreenshotExtraction): VisibilityScreenshotExtraction {
  const averagePosition = normalizeAveragePosition(extraction.fields.averagePosition);
  if (averagePosition === extraction.fields.averagePosition) return extraction;

  return {
    ...extraction,
    fields: { ...extraction.fields, averagePosition },
    lowConfidenceFields: extraction.lowConfidenceFields.includes("averagePosition")
      ? extraction.lowConfidenceFields
      : [...extraction.lowConfidenceFields, "averagePosition"],
  };
}

function reportLikelihood(text: string): number {
  const normalized = text.toLowerCase();
  return (
    (normalized.includes("scan report") ? 3 : 0) +
    (normalized.includes("searching") ? 1 : 0) +
    (/\barp\b/i.test(text) ? 3 : 0) +
    (normalized.includes("searched using") ? 2 : 0) +
    (normalized.includes("radius") ? 1 : 0)
  );
}

export function parseVisibilityScanText(
  text: string,
  metricText = "",
  arpTileText = "",
): Pick<VisibilityScreenshotAnalysis, "fields" | "lowConfidenceFields"> {
  const lines = text.split(/\r?\n/).map(cleanOcrLine).filter(Boolean);
  const joined = lines.join("\n");
  const addressIndex = lines.findIndex((line) => /^\d{2,6}\s+.+,\s*.+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/i.test(line));
  const address = addressIndex >= 0 ? lines[addressIndex] : null;

  let businessName: string | null = null;
  if (addressIndex > 0) {
    for (let index = addressIndex - 1; index >= 0; index -= 1) {
      const candidate = lines[index];
      if (/searching|google maps|\bfor:?$/i.test(candidate)) continue;
      businessName = candidate.replace(/^for:\s*/i, "").trim() || null;
      break;
    }
  }

  const searchPhrase = matchValue(joined, /Searching\s+["“']([^"”'\n]+)["”']/i);
  const ratingReviewMatch = joined.match(/(?:^|\n)\s*([0-5](?:\.\d)?)\s+[^\n]*?\((\d{1,6})\)/m);
  const compactRatingReviewMatch = joined.match(/(?:^|\n)\s*([0-5])\s*([0-9])\s+[^\n]*?\((\d{1,6})\)/m);
  const independentReviewMatch = joined.match(/[\[(]\s*(\d{1,6})(?:\s*(?:\)|\]))?/m);
  const labeledAveragePosition = extractLabeledArp(`${joined}\n${metricText}\n${arpTileText}`);
  const tileAveragePosition = normalizeAveragePosition(matchValue(
    arpTileText,
    /\b([0-9]{1,2}\s*[.,]\s*[0-9](?:\s*[0-9])?)\b/,
  ));
  const averagePosition = labeledAveragePosition || tileAveragePosition;
  const gridMatch = joined.match(/(\d+)\s*[x×]\s*(\d+)\s*grid/i);
  const radius = matchValue(joined, /(?:a|an)?\s*([0-9]+(?:\.\d+)?)\s*mi(?:le)?\s*radius/i);
  const marketMatch = address?.match(/,\s*([^,]+),\s*([A-Z]{2})\s*\d{5}(?:-\d{4})?$/i);
  const market = marketMatch ? `${marketMatch[1].trim()}, ${marketMatch[2].toUpperCase()}` : null;

  const fields: VisibilityScreenshotAnalysis["fields"] = {
    businessName,
    address,
    rating: ratingReviewMatch?.[1] || (compactRatingReviewMatch ? `${compactRatingReviewMatch[1]}.${compactRatingReviewMatch[2]}` : null),
    reviewCount: ratingReviewMatch?.[2] || compactRatingReviewMatch?.[3] || independentReviewMatch?.[1] || null,
    searchPhrase,
    market,
    averagePosition,
    gridSize: gridMatch ? `${gridMatch[1]} × ${gridMatch[2]}` : null,
    radius,
  };

  const lowConfidenceFields: VisibilityScreenshotAnalysis["lowConfidenceFields"] = [];
  if (businessName) lowConfidenceFields.push("businessName");
  if (market) lowConfidenceFields.push("market");
  if (!labeledAveragePosition && tileAveragePosition) lowConfidenceFields.push("averagePosition");
  return { fields, lowConfidenceFields };
}

async function recognizeReportDetails(
  worker: Awaited<ReturnType<typeof createWorker>>,
  screenshot: ScreenshotInput,
  fullText: string,
): Promise<Pick<VisibilityScreenshotAnalysis, "fields" | "lowConfidenceFields">> {
  const metadata = await sharp(screenshot.buffer).metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) return parseVisibilityScanText(fullText);

  const recognizeCrop = async (leftRatio: number, topRatio: number, widthRatio: number, heightRatio: number) => {
    const left = Math.min(width - 1, Math.floor(width * leftRatio));
    const top = Math.min(height - 1, Math.floor(height * topRatio));
    const cropWidth = Math.max(1, Math.min(width - left, Math.floor(width * widthRatio)));
    const cropHeight = Math.max(1, Math.min(height - top, Math.floor(height * heightRatio)));
    const crop = await sharp(screenshot.buffer)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .resize({ width: Math.min(cropWidth * 5, 3000) })
      .greyscale()
      .normalize()
      .png()
      .toBuffer();
    return (await worker.recognize(crop)).data.text;
  };

  const businessText = await recognizeCrop(0, 0.36, 1, 0.36);
  const ratingText = await recognizeCrop(0.14, 0.42, 0.58, 0.24);
  const metricText = await recognizeCrop(0.12, 0.67, 0.72, 0.2);
  const arpTileText = await recognizeCrop(0.275, 0.7, 0.12, 0.115);
  return parseVisibilityScanText(`${fullText}\n${businessText}\n${ratingText}`, metricText, arpTileText);
}

async function analyzeWithLocalOcr(
  screenshots: [ScreenshotInput, ScreenshotInput],
): Promise<VisibilityScreenshotExtraction> {
  const cachePath = process.env.TESSERACT_CACHE_PATH || path.join(tmpdir(), "viva-tesseract-cache");
  await mkdir(cachePath, { recursive: true });
  const worker = await createWorker("eng", 1, { cachePath });
  try {
    const firstText = (await worker.recognize(screenshots[0].buffer)).data.text;
    const firstScore = reportLikelihood(firstText);
    let reportImageIndex = 0;
    let reportText = firstText;

    if (firstScore < 4) {
      const secondText = (await worker.recognize(screenshots[1].buffer)).data.text;
      const secondScore = reportLikelihood(secondText);
      if (secondScore > firstScore) {
        reportImageIndex = 1;
        reportText = secondText;
      }
      if (Math.max(firstScore, secondScore) < 4) {
        const error = new Error("A Local Falcon scan report could not be identified. Paste the report summary and heatmap screenshots.");
        (error as Error & { statusCode?: number }).statusCode = 422;
        throw error;
      }
    }

    const parsed = await recognizeReportDetails(worker, screenshots[reportImageIndex], reportText);
    return {
      reportImageIndex,
      heatmapImageIndex: 1 - reportImageIndex,
      ...parsed,
    };
  } finally {
    await worker.terminate();
  }
}

function enqueueLocalOcr(screenshots: [ScreenshotInput, ScreenshotInput]): Promise<VisibilityScreenshotExtraction> {
  const task = ocrQueue.then(() => analyzeWithLocalOcr(screenshots));
  ocrQueue = task.catch(() => undefined);
  return task;
}

async function analyzeWithOpenAI(
  screenshots: [ScreenshotInput, ScreenshotInput],
  userId: string,
  apiKey: string,
): Promise<VisibilityScreenshotExtraction> {
  const client = new OpenAI({ apiKey });
  const response = await client.responses.parse({
    model: process.env.OPENAI_VISIBILITY_MODEL || "gpt-5.6-luna",
    instructions: EXTRACTION_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: "Image 0:" },
          { type: "input_image", image_url: toDataUrl(screenshots[0]), detail: "high" },
          { type: "input_text", text: "Image 1:" },
          { type: "input_image", image_url: toDataUrl(screenshots[1]), detail: "high" },
        ],
      },
    ],
    text: {
      format: zodTextFormat(visibilityScreenshotExtractionSchema, "local_visibility_scan"),
    },
    reasoning: { effort: "low" },
    max_output_tokens: 1200,
    safety_identifier: safetyIdentifier(userId),
    store: false,
  });

  if (!response.output_parsed) {
    const error = new Error("The screenshots could not be read. Try pasting clearer images.");
    (error as Error & { statusCode?: number }).statusCode = 422;
    throw error;
  }
  return response.output_parsed;
}

export function attachOriginalHeatmap(
  extraction: VisibilityScreenshotExtraction,
  screenshots: [ScreenshotInput, ScreenshotInput],
): VisibilityScreenshotAnalysis {
  const heatmapIndex = extraction.heatmapImageIndex >= 0 && extraction.heatmapImageIndex <= 1
    ? extraction.heatmapImageIndex
    : extraction.reportImageIndex >= 0
      ? 1 - extraction.reportImageIndex
      : -1;
  if (heatmapIndex < 0) return { ...extraction, heatmapImageDataUrl: null };

  return {
    ...extraction,
    heatmapImageDataUrl: toDataUrl(screenshots[heatmapIndex]),
  };
}

export async function analyzeVisibilityScreenshots(
  screenshots: [ScreenshotInput, ScreenshotInput],
  userId: string,
): Promise<VisibilityScreenshotAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  let extraction: VisibilityScreenshotExtraction;
  if (apiKey) {
    try {
      extraction = await analyzeWithOpenAI(screenshots, userId, apiKey);
      return attachOriginalHeatmap(sanitizeExtraction(extraction), screenshots);
    } catch {
      console.warn("[local-visibility] OpenAI extraction failed; using local OCR fallback");
    }
  }
  extraction = await enqueueLocalOcr(screenshots);
  return attachOriginalHeatmap(sanitizeExtraction(extraction), screenshots);
}
