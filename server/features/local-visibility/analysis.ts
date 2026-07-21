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

export const visibilityScreenshotAnalysisSchema = z.object({
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

export type VisibilityScreenshotAnalysis = z.infer<typeof visibilityScreenshotAnalysisSchema>;

type ScreenshotInput = {
  buffer: Buffer;
  mimeType: string;
};

let ocrQueue: Promise<unknown> = Promise.resolve();

const EXTRACTION_INSTRUCTIONS = `You extract Local Falcon scan data for a local SEO report generator.

You will receive exactly two numbered screenshots. One is normally a compact "Scan Report" summary and the other is the ranking heatmap. Identify their zero-based image indexes and extract fields only from visible evidence.

Rules:
- averagePosition must come from ARP (Average Rank Position). Never use ATRP or SoLV.
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
  const averagePosition = matchValue(joined, /(?:^|\s)ARP\s*[:|]?\s*([0-9]+(?:\.\d+)?)/i)
    || matchValue(metricText, /([0-9]+(?:[.,][0-9]+))/)?.replace(",", ".")
    || null;
  const gridMatch = joined.match(/(\d+)\s*[x×]\s*(\d+)\s*grid/i);
  const radius = matchValue(joined, /(?:a|an)?\s*([0-9]+(?:\.\d+)?)\s*mi(?:le)?\s*radius/i);
  const marketMatch = address?.match(/,\s*([^,]+),\s*([A-Z]{2})\s*\d{5}(?:-\d{4})?$/i);
  const market = marketMatch ? `${marketMatch[1].trim()}, ${marketMatch[2].toUpperCase()}` : null;

  const fields: VisibilityScreenshotAnalysis["fields"] = {
    businessName,
    address,
    rating: ratingReviewMatch?.[1] || (compactRatingReviewMatch ? `${compactRatingReviewMatch[1]}.${compactRatingReviewMatch[2]}` : null),
    reviewCount: ratingReviewMatch?.[2] || compactRatingReviewMatch?.[3] || null,
    searchPhrase,
    market,
    averagePosition,
    gridSize: gridMatch ? `${gridMatch[1]} × ${gridMatch[2]}` : null,
    radius,
  };

  const lowConfidenceFields: VisibilityScreenshotAnalysis["lowConfidenceFields"] = [];
  if (businessName) lowConfidenceFields.push("businessName");
  if (market) lowConfidenceFields.push("market");
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

  const recognizeCrop = async (topRatio: number, heightRatio: number) => {
    const top = Math.min(height - 1, Math.floor(height * topRatio));
    const cropHeight = Math.max(1, Math.min(height - top, Math.floor(height * heightRatio)));
    const crop = await sharp(screenshot.buffer)
      .extract({ left: 0, top, width, height: cropHeight })
      .resize({ width: Math.min(width * 3, 3000) })
      .greyscale()
      .normalize()
      .png()
      .toBuffer();
    return (await worker.recognize(crop)).data.text;
  };

  const businessText = await recognizeCrop(0.38, 0.36);
  const metricText = await recognizeCrop(0.70, 0.22);
  return parseVisibilityScanText(`${fullText}\n${businessText}`, metricText);
}

async function analyzeWithLocalOcr(
  screenshots: [ScreenshotInput, ScreenshotInput],
): Promise<VisibilityScreenshotAnalysis> {
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

function enqueueLocalOcr(screenshots: [ScreenshotInput, ScreenshotInput]): Promise<VisibilityScreenshotAnalysis> {
  const task = ocrQueue.then(() => analyzeWithLocalOcr(screenshots));
  ocrQueue = task.catch(() => undefined);
  return task;
}

async function analyzeWithOpenAI(
  screenshots: [ScreenshotInput, ScreenshotInput],
  userId: string,
  apiKey: string,
): Promise<VisibilityScreenshotAnalysis> {
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
      format: zodTextFormat(visibilityScreenshotAnalysisSchema, "local_visibility_scan"),
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

export async function analyzeVisibilityScreenshots(
  screenshots: [ScreenshotInput, ScreenshotInput],
  userId: string,
): Promise<VisibilityScreenshotAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      return await analyzeWithOpenAI(screenshots, userId, apiKey);
    } catch {
      console.warn("[local-visibility] OpenAI extraction failed; using local OCR fallback");
    }
  }
  return enqueueLocalOcr(screenshots);
}
