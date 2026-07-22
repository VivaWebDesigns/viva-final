import { ChangeEvent, ClipboardEvent, DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  ClipboardPaste,
  Download,
  FileImage,
  ImagePlus,
  Loader2,
  Move,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import LocalVisibilityReportTemplate, { type MapPosition } from "./LocalVisibilityReportTemplate";
import {
  DEFAULT_LOCAL_VISIBILITY_REPORT,
  LOCAL_VISIBILITY_REPORT_HEIGHT,
  LOCAL_VISIBILITY_REPORT_WIDTH,
  normalizeGridSize,
  type ExtractableVisibilityField,
  type LocalVisibilityReportData,
  type VisibilityScreenshotAnalysis,
} from "./types";

const REPORT_WIDTH = LOCAL_VISIBILITY_REPORT_WIDTH;
const REPORT_HEIGHT = LOCAL_VISIBILITY_REPORT_HEIGHT;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_SMART_PASTE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type FieldErrors = Partial<Record<keyof LocalVisibilityReportData, string>>;

function validateReport(data: LocalVisibilityReportData): FieldErrors {
  const errors: FieldErrors = {};
  if (!data.businessName.trim()) errors.businessName = "Business name is required.";
  if (!data.searchPhrase.trim()) errors.searchPhrase = "Search phrase is required.";
  if (!data.market.trim()) errors.market = "Market is required.";
  if (!data.heatmapImageUrl) errors.heatmapImageUrl = "Upload a heatmap image.";

  const averagePosition = Number(data.averagePosition);
  if (!data.averagePosition.trim() || !Number.isFinite(averagePosition) || averagePosition <= 0) {
    errors.averagePosition = "Enter a position greater than 0.";
  }

  if (data.rating.trim()) {
    const rating = Number(data.rating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      errors.rating = "Rating must be between 0 and 5.";
    }
  }

  if (data.reviewCount.trim()) {
    const reviewCount = Number(data.reviewCount);
    if (!Number.isInteger(reviewCount) || reviewCount < 0) {
      errors.reviewCount = "Review count must be a whole number.";
    }
  }

  if (!/^\s*\d+\s*[x×]\s*\d+\s*$/i.test(data.gridSize)) {
    errors.gridSize = "Use a format like 7 × 7.";
  }

  const radius = Number(data.radius);
  if (!data.radius.trim() || !Number.isFinite(radius) || radius <= 0) {
    errors.radius = "Enter a radius greater than 0.";
  }

  return errors;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "local-visibility";
}

type FormFieldProps = {
  id: keyof LocalVisibilityReportData;
  label: string;
  value: string;
  error?: string;
  needsReview?: boolean;
  optional?: boolean;
  placeholder?: string;
  type?: "text" | "number";
  step?: string;
  min?: string;
  max?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function FormField({ id, label, error, needsReview, optional, ...inputProps }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {optional && <span className="text-[11px] text-gray-400">Optional</span>}
      </div>
      <Input
        id={id}
        name={id}
        aria-invalid={Boolean(error)}
        className={needsReview ? "border-amber-400 bg-amber-50/40 focus-visible:ring-amber-400" : undefined}
        {...inputProps}
      />
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      {!error && needsReview && (
        <p className="flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle className="h-3 w-3" /> Check this extracted value.
        </p>
      )}
    </div>
  );
}

type QueuedScreenshot = {
  id: string;
  file: File;
  previewUrl: string;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

type LocalVisibilityReportPageProps = {
  initialData?: LocalVisibilityReportData;
};

export default function LocalVisibilityReportPage({ initialData }: LocalVisibilityReportPageProps = {}) {
  const [data, setData] = useState<LocalVisibilityReportData>(() => initialData ?? DEFAULT_LOCAL_VISIBILITY_REPORT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [previewReady, setPreviewReady] = useState(false);
  const [activeExport, setActiveExport] = useState<"copy" | "download" | null>(null);
  const [previewScale, setPreviewScale] = useState(0.55);
  const [queuedScreenshots, setQueuedScreenshots] = useState<QueuedScreenshot[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analyzedIndexes, setAnalyzedIndexes] = useState<{ report: number; heatmap: number } | null>(null);
  const [reviewFields, setReviewFields] = useState<Set<ExtractableVisibilityField>>(new Set());
  const [mapZoom, setMapZoom] = useState(100);
  const [mapPosition, setMapPosition] = useState<MapPosition>({ x: 0, y: 0 });
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const smartPasteInputRef = useRef<HTMLInputElement>(null);
  const lastAnalyzedSignatureRef = useRef("");
  const { toast } = useToast();

  const measurePreview = useCallback(() => {
    const width = previewViewportRef.current?.clientWidth ?? 0;
    if (width > 0) setPreviewScale(Math.min(0.72, width / REPORT_WIDTH));
  }, []);

  useEffect(() => {
    measurePreview();
    const viewport = previewViewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(measurePreview);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [measurePreview]);

  const updateField = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof LocalVisibilityReportData;
    const value = field === "gridSize" ? normalizeGridSize(event.target.value) : event.target.value;
    setData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setReviewFields((current) => {
      if (field === "heatmapImageUrl" || !current.has(field)) return current;
      const next = new Set(current);
      next.delete(field);
      return next;
    });
    setPreviewReady(false);
  };

  const addSmartPasteImages = useCallback(async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) return;

    const invalidType = images.find((file) => !SUPPORTED_IMAGE_TYPES.has(file.type));
    if (invalidType) {
      setAnalysisError("Use PNG, JPG, or WebP screenshots.");
      return;
    }
    const oversized = images.find((file) => file.size > MAX_SMART_PASTE_BYTES);
    if (oversized) {
      setAnalysisError(`${oversized.name || "A screenshot"} is larger than 10 MB.`);
      return;
    }

    try {
      const availableSlots = Math.max(0, 2 - queuedScreenshots.length);
      const selected = images.slice(0, availableSlots);
      if (selected.length === 0) {
        setAnalysisError("Remove a screenshot before adding another.");
        return;
      }
      const additions = await Promise.all(selected.map(async (file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: await fileToDataUrl(file),
      })));
      setQueuedScreenshots((current) => [...current, ...additions].slice(0, 2));
      setAnalysisError("");
      setAnalyzedIndexes(null);
      lastAnalyzedSignatureRef.current = "";
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "The screenshots could not be read.");
    }
  }, [queuedScreenshots.length]);

  const analyzeScreenshots = useCallback(async (screenshots: QueuedScreenshot[]) => {
    if (screenshots.length !== 2 || isAnalyzing) return;
    const signature = screenshots.map((item) => item.id).join("|");
    if (lastAnalyzedSignatureRef.current === signature) return;
    lastAnalyzedSignatureRef.current = signature;
    setIsAnalyzing(true);
    setAnalysisError("");

    try {
      const formData = new FormData();
      screenshots.forEach((item) => formData.append("screenshots", item.file, item.file.name || "screenshot.png"));
      const response = await fetch("/api/local-visibility/analyze-screenshots", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const body = await response.json().catch(() => ({})) as VisibilityScreenshotAnalysis & { message?: string };
      if (!response.ok) throw new Error(body.message || "Screenshot analysis failed.");

      const heatmapIndex = body.heatmapImageIndex >= 0 && body.heatmapImageIndex < screenshots.length
        ? body.heatmapImageIndex
        : body.reportImageIndex >= 0
          ? 1 - body.reportImageIndex
          : -1;

      setData((current) => {
        const next = { ...current };
        for (const [field, value] of Object.entries(body.fields) as [ExtractableVisibilityField, string | null][]) {
          if (!value?.trim()) continue;
          next[field] = field === "gridSize" ? normalizeGridSize(value) : value.trim();
        }
        if (heatmapIndex >= 0) {
          next.heatmapImageUrl = body.heatmapImageDataUrl || screenshots[heatmapIndex].previewUrl;
        }
        return next;
      });
      setMapZoom(100);
      setMapPosition({ x: 0, y: 0 });
      setErrors({});
      setReviewFields(new Set(body.lowConfidenceFields));
      setAnalyzedIndexes({ report: body.reportImageIndex, heatmap: heatmapIndex });
      setPreviewReady(false);
      toast({
        title: "Screenshots analyzed",
        description: body.lowConfidenceFields.length
          ? "Fields were filled in. Review the highlighted values."
          : "The report fields and heatmap were filled in automatically.",
      });
    } catch (error) {
      lastAnalyzedSignatureRef.current = "";
      const message = error instanceof Error ? error.message : "Screenshot analysis failed.";
      setAnalysisError(message);
      toast({ title: "Could not analyze screenshots", description: message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, toast]);

  useEffect(() => {
    if (queuedScreenshots.length === 2) void analyzeScreenshots(queuedScreenshots);
  }, [analyzeScreenshots, queuedScreenshots]);

  useEffect(() => {
    const onPaste = (event: globalThis.ClipboardEvent) => {
      const imageFiles = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length === 0) return;
      event.preventDefault();
      void addSmartPasteImages(imageFiles);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addSmartPasteImages]);

  const handleSmartPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const imageFiles = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    void addSmartPasteImages(imageFiles);
  };

  const handleSmartDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void addSmartPasteImages(Array.from(event.dataTransfer.files));
  };

  const removeQueuedScreenshot = (id: string) => {
    setQueuedScreenshots((current) => current.filter((item) => item.id !== id));
    setAnalyzedIndexes(null);
    setAnalysisError("");
    lastAnalyzedSignatureRef.current = "";
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrors((current) => ({ ...current, heatmapImageUrl: "Choose a PNG, JPG, or WebP image." }));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setErrors((current) => ({ ...current, heatmapImageUrl: "Image must be 15 MB or smaller." }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setData((current) => ({ ...current, heatmapImageUrl: String(reader.result) }));
      setMapZoom(100);
      setMapPosition({ x: 0, y: 0 });
      setErrors((current) => ({ ...current, heatmapImageUrl: undefined }));
      setPreviewReady(false);
    };
    reader.onerror = () => {
      setErrors((current) => ({ ...current, heatmapImageUrl: "The image could not be read." }));
    };
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const nextErrors = validateReport(data);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const generatePreview = () => {
    if (!validate()) {
      toast({
        title: "Complete the required fields",
        description: "Fix the highlighted fields before generating the report.",
        variant: "destructive",
      });
      return;
    }
    setPreviewReady(true);
    toast({ title: "Preview ready", description: "Review the snapshot, then copy or download the PNG." });
  };

  const renderReportBlob = async () => {
    if (!reportRef.current) throw new Error("The report preview is not ready.");
    await document.fonts?.ready;
    const blob = await toBlob(reportRef.current, {
      width: REPORT_WIDTH,
      height: REPORT_HEIGHT,
      canvasWidth: REPORT_WIDTH,
      canvasHeight: REPORT_HEIGHT,
      pixelRatio: 1,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });
    if (!blob) throw new Error("The report image could not be created.");
    return blob;
  };

  const copyReport = async () => {
    if (!validate() || !reportRef.current) return;
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      toast({
        title: "Image copying is not available",
        description: "Use Download PNG instead, or open the generator over HTTPS in a supported browser.",
        variant: "destructive",
      });
      return;
    }

    setActiveExport("copy");
    try {
      const blobPromise = renderReportBlob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
      toast({ title: "Report copied", description: "Paste it directly into Messages or your SMS app." });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: error instanceof Error ? error.message : "Use Download PNG and attach the saved image instead.",
        variant: "destructive",
      });
    } finally {
      setActiveExport(null);
    }
  };

  const downloadReport = async () => {
    if (!validate() || !reportRef.current) return;
    setActiveExport("download");
    try {
      const image = await renderReportBlob();
      const imageUrl = URL.createObjectURL(image);
      const link = document.createElement("a");
      link.download = `${slugify(data.businessName)}-local-visibility-snapshot.png`;
      link.href = imageUrl;
      link.click();
      URL.revokeObjectURL(imageUrl);
      toast({ title: "PNG downloaded", description: "The report was exported at 1080 × 1920." });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActiveExport(null);
    }
  };

  const reset = () => {
    setData(initialData ?? DEFAULT_LOCAL_VISIBILITY_REPORT);
    setErrors({});
    setPreviewReady(false);
    setQueuedScreenshots([]);
    setAnalysisError("");
    setAnalyzedIndexes(null);
    setReviewFields(new Set());
    setMapZoom(100);
    setMapPosition({ x: 0, y: 0 });
    lastAnalyzedSignatureRef.current = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (smartPasteInputRef.current) smartPasteInputRef.current.value = "";
  };

  return (
    <div className="min-h-full bg-[#f5f7fa] p-4 md:p-6" data-testid="local-visibility-report-page">
      <div className="mx-auto max-w-[1680px]">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[#0b67b2]">
              <FileImage className="h-4 w-4" /> Internal report tool
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#061a3d] md:text-3xl">Local Visibility Snapshot</h1>
            <p className="mt-1 text-sm text-gray-500">Build a mobile-first 1080 × 1920 client report from a Local Falcon scan.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={reset} data-testid="button-reset-report">
              <RefreshCw /> Reset
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={copyReport}
              disabled={!previewReady || activeExport !== null}
              className="border-[#0b67b2] text-[#0b67b2] hover:bg-blue-50 hover:text-[#07568f]"
              data-testid="button-copy-report"
            >
              <ClipboardCopy /> {activeExport === "copy" ? "Copying…" : "Copy Report Image"}
            </Button>
            <Button
              type="button"
              onClick={downloadReport}
              disabled={!previewReady || activeExport !== null}
              className="bg-[#061a3d] text-white hover:bg-[#0b2b59]"
              data-testid="button-download-report"
            >
              <Download /> {activeExport === "download" ? "Exporting…" : "Download PNG"}
            </Button>
          </div>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-gray-200 bg-white shadow-sm xl:sticky xl:top-5">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-semibold text-[#061a3d]">Report details</h2>
              <p className="mt-0.5 text-xs text-gray-500">The preview updates as you type.</p>
            </div>

            <form className="space-y-5 p-5" onSubmit={(event) => { event.preventDefault(); generatePreview(); }}>
              <section className="space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#0b67b2]" />
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0b67b2]">Smart paste</p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-gray-500">Paste the scan report and heatmap in either order. Fields fill automatically after the second image.</p>
                </div>
                <input
                  ref={smartPasteInputRef}
                  id="smart-paste-upload"
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(event) => {
                    void addSmartPasteImages(Array.from(event.target.files ?? []));
                    event.currentTarget.value = "";
                  }}
                  data-testid="input-smart-paste-upload"
                />
                <div
                  role="group"
                  aria-label="Paste or drop screenshots"
                  tabIndex={0}
                  onPaste={handleSmartPaste}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleSmartDrop}
                  onClick={(event) => event.currentTarget.focus()}
                  className="rounded-xl border-2 border-dashed border-[#7ca8ca] bg-[#f5faff] p-4 text-center outline-none transition-colors focus-within:bg-[#eaf5fc] focus-visible:ring-2 focus-visible:ring-[#0b67b2]"
                  data-testid="smart-paste-zone"
                >
                  {isAnalyzing ? (
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#0b67b2]" />
                  ) : (
                    <ClipboardPaste className="mx-auto h-7 w-7 text-[#0b67b2]" />
                  )}
                  <p className="mt-2 text-sm font-semibold text-[#061a3d]">
                    {isAnalyzing ? "Reading screenshots…" : "Press ⌘V or drop two images"}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">{queuedScreenshots.length} of 2 images added · PNG, JPG, or WebP</p>
                  {!isAnalyzing && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 bg-white"
                      onClick={(event) => {
                        event.stopPropagation();
                        smartPasteInputRef.current?.click();
                      }}
                    >
                      <ImagePlus /> Choose files
                    </Button>
                  )}
                </div>

                {queuedScreenshots.length > 0 && (
                  <div className="grid grid-cols-2 gap-2" data-testid="smart-paste-thumbnails">
                    {queuedScreenshots.map((item, index) => {
                      const label = analyzedIndexes?.report === index
                        ? "Scan report"
                        : analyzedIndexes?.heatmap === index
                          ? "Heatmap"
                          : `Image ${index + 1}`;
                      return (
                        <div key={item.id} className="relative overflow-hidden rounded-lg border border-gray-200 bg-white">
                          <img src={item.previewUrl} alt={label} className="h-20 w-full object-contain" />
                          <div className="flex items-center justify-between gap-1 border-t border-gray-100 px-2 py-1">
                            <span className="truncate text-[10px] font-semibold text-gray-600">{label}</span>
                            <button
                              type="button"
                              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                              aria-label={`Remove ${label}`}
                              onClick={(event) => { event.stopPropagation(); removeQueuedScreenshot(item.id); }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {analyzedIndexes && !isAnalyzing && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700" data-testid="smart-paste-success">
                    <CheckCircle2 className="h-4 w-4" /> Fields and heatmap added. Review before generating.
                  </p>
                )}
                {analysisError && (
                  <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3" role="alert">
                    <p className="text-xs text-red-700">{analysisError}</p>
                    {queuedScreenshots.length === 2 && (
                      <Button type="button" size="sm" variant="outline" onClick={() => void analyzeScreenshots(queuedScreenshots)}>
                        <RefreshCw /> Try again
                      </Button>
                    )}
                  </div>
                )}
                <p className="text-[10px] leading-4 text-gray-400">Screenshots are processed securely and are not attached to or saved in Viva records.</p>
              </section>

              <div className="border-t border-gray-100" />
              <section className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5" data-testid="map-controls">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Label htmlFor="map-zoom" className="text-xs font-semibold text-[#061a3d]">Map zoom</Label>
                  <span className="text-xs font-semibold tabular-nums text-[#0b67b2]">{mapZoom}%</span>
                </div>
                <input
                  id="map-zoom"
                  type="range"
                  min="70"
                  max="160"
                  step="5"
                  value={mapZoom}
                  disabled={!data.heatmapImageUrl}
                  onChange={(event) => {
                    setMapZoom(Number(event.target.value));
                    setPreviewReady(false);
                  }}
                  className="h-2 w-full cursor-pointer accent-[#0b67b2] disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="input-map-zoom"
                />
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-gray-200 pt-2">
                  <p className="flex items-center gap-1 text-[10px] leading-4 text-gray-500">
                    <Move className="h-3 w-3" />
                    {data.heatmapImageUrl ? "Drag the map in the preview to reposition it." : "Add a heatmap to enable map controls."}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 shrink-0 px-2 text-[10px] text-[#0b67b2]"
                    onClick={() => {
                      setMapPosition({ x: 0, y: 0 });
                      setPreviewReady(false);
                    }}
                    disabled={!data.heatmapImageUrl || (mapPosition.x === 0 && mapPosition.y === 0)}
                    data-testid="button-center-map"
                  >
                    Center map
                  </Button>
                </div>
              </section>

              <section className="space-y-3 border-t border-gray-100 pt-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0b67b2]">Business</p>
                <FormField id="businessName" label="Business name" value={data.businessName} error={errors.businessName} needsReview={reviewFields.has("businessName")} placeholder="The Shower Glass" onChange={updateField} />
                <FormField id="address" label="Address" value={data.address} error={errors.address} needsReview={reviewFields.has("address")} optional placeholder="8334 Pineville-Matthews Rd, Charlotte, NC" onChange={updateField} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField id="rating" label="Google rating" value={data.rating} error={errors.rating} needsReview={reviewFields.has("rating")} optional type="number" min="0" max="5" step="0.1" placeholder="5.0" onChange={updateField} />
                  <FormField id="reviewCount" label="Review count" value={data.reviewCount} error={errors.reviewCount} needsReview={reviewFields.has("reviewCount")} optional type="number" min="0" step="1" placeholder="40" onChange={updateField} />
                </div>
              </section>

              <section className="space-y-3 border-t border-gray-100 pt-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0b67b2]">Scan</p>
                <FormField id="searchPhrase" label="Search phrase" value={data.searchPhrase} error={errors.searchPhrase} needsReview={reviewFields.has("searchPhrase")} placeholder="frameless shower glass near me" onChange={updateField} />
                <FormField id="market" label="Market" value={data.market} error={errors.market} needsReview={reviewFields.has("market")} placeholder="Charlotte, NC" onChange={updateField} />
                <FormField id="averagePosition" label="Average Google Maps position" value={data.averagePosition} error={errors.averagePosition} needsReview={reviewFields.has("averagePosition")} type="number" min="0.1" step="0.01" placeholder="3.96" onChange={updateField} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField id="gridSize" label="Grid size" value={data.gridSize} error={errors.gridSize} needsReview={reviewFields.has("gridSize")} placeholder="7 × 7" onChange={updateField} />
                  <FormField id="radius" label="Radius (miles)" value={data.radius} error={errors.radius} needsReview={reviewFields.has("radius")} type="number" min="0.1" step="0.1" placeholder="2.5" onChange={updateField} />
                </div>
              </section>

              <section className="space-y-3 border-t border-gray-100 pt-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0b67b2]">Heatmap</p>
                  <p className="mt-1 text-xs text-gray-500">Upload the full Local Falcon scan with its 7 × 7 ranking grid.</p>
                </div>
                <input
                  ref={fileInputRef}
                  id="heatmap-upload"
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageUpload}
                  data-testid="input-heatmap-upload"
                />
                <Label
                  htmlFor="heatmap-upload"
                  className="flex min-h-20 cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-[#7ca8ca] bg-[#f5faff] px-4 py-3 text-center text-sm font-semibold text-[#0b67b2] transition-colors hover:bg-[#eaf5fc]"
                >
                  <ImagePlus className="h-5 w-5" />
                  {data.heatmapImageUrl ? "Replace heatmap image" : "Upload heatmap image"}
                </Label>
                {errors.heatmapImageUrl && <p className="text-xs text-red-600" role="alert">{errors.heatmapImageUrl}</p>}
              </section>

              <Button type="submit" className="w-full bg-[#0b67b2] text-white hover:bg-[#07568f]" data-testid="button-generate-preview">
                <Sparkles /> Generate Preview
              </Button>
            </form>
          </aside>

          <main className="min-w-0 rounded-xl border border-gray-200 bg-[#e9eef3] p-3 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-[#061a3d]">Report preview</h2>
                <p className="text-xs text-gray-500">Exports at 1080 × 1920 PNG</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${previewReady ? "bg-emerald-100 text-emerald-700" : "bg-white text-gray-500"}`}>
                {previewReady ? "Ready to download" : "Draft"}
              </span>
            </div>
            <div ref={previewViewportRef} className="w-full overflow-hidden rounded-lg" data-testid="report-preview-viewport">
              <div style={{ width: REPORT_WIDTH * previewScale, height: REPORT_HEIGHT * previewScale }}>
                <div style={{ width: REPORT_WIDTH, height: REPORT_HEIGHT, transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
                  <LocalVisibilityReportTemplate
                    ref={reportRef}
                    data={data}
                    mapZoom={mapZoom}
                    mapPosition={mapPosition}
                    onMapPositionChange={(position) => {
                      setMapPosition(position);
                      setPreviewReady(false);
                    }}
                  />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
