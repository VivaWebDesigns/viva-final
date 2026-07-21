import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, FileImage, ImagePlus, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import LocalVisibilityReportTemplate from "./LocalVisibilityReportTemplate";
import {
  DEFAULT_LOCAL_VISIBILITY_REPORT,
  normalizeGridSize,
  type LocalVisibilityReportData,
} from "./types";

const REPORT_WIDTH = 1080;
const REPORT_HEIGHT = 1350;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

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
  optional?: boolean;
  placeholder?: string;
  type?: "text" | "number";
  step?: string;
  min?: string;
  max?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function FormField({ id, label, error, optional, ...inputProps }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {optional && <span className="text-[11px] text-gray-400">Optional</span>}
      </div>
      <Input id={id} name={id} aria-invalid={Boolean(error)} {...inputProps} />
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

type LocalVisibilityReportPageProps = {
  initialData?: LocalVisibilityReportData;
};

export default function LocalVisibilityReportPage({ initialData }: LocalVisibilityReportPageProps = {}) {
  const [data, setData] = useState<LocalVisibilityReportData>(() => initialData ?? DEFAULT_LOCAL_VISIBILITY_REPORT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [previewReady, setPreviewReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.55);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    setPreviewReady(false);
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
    toast({ title: "Preview ready", description: "Review the snapshot, then download the PNG." });
  };

  const downloadReport = async () => {
    if (!validate() || !reportRef.current) return;
    setIsExporting(true);
    try {
      await document.fonts.ready;
      const image = await toPng(reportRef.current, {
        width: REPORT_WIDTH,
        height: REPORT_HEIGHT,
        canvasWidth: REPORT_WIDTH,
        canvasHeight: REPORT_HEIGHT,
        pixelRatio: 1,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `${slugify(data.businessName)}-local-visibility-snapshot.png`;
      link.href = image;
      link.click();
      toast({ title: "PNG downloaded", description: "The report was exported at 1080 × 1350." });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const reset = () => {
    setData(initialData ?? DEFAULT_LOCAL_VISIBILITY_REPORT);
    setErrors({});
    setPreviewReady(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
            <p className="mt-1 text-sm text-gray-500">Build a branded 1080 × 1350 client report from a Local Falcon scan.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={reset} data-testid="button-reset-report">
              <RefreshCw /> Reset
            </Button>
            <Button
              type="button"
              onClick={downloadReport}
              disabled={!previewReady || isExporting}
              className="bg-[#061a3d] text-white hover:bg-[#0b2b59]"
              data-testid="button-download-report"
            >
              <Download /> {isExporting ? "Exporting…" : "Download PNG"}
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
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0b67b2]">Business</p>
                <FormField id="businessName" label="Business name" value={data.businessName} error={errors.businessName} placeholder="The Shower Glass" onChange={updateField} />
                <FormField id="address" label="Address" value={data.address} error={errors.address} optional placeholder="8334 Pineville-Matthews Rd, Charlotte, NC" onChange={updateField} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField id="rating" label="Google rating" value={data.rating} error={errors.rating} optional type="number" min="0" max="5" step="0.1" placeholder="5.0" onChange={updateField} />
                  <FormField id="reviewCount" label="Review count" value={data.reviewCount} error={errors.reviewCount} optional type="number" min="0" step="1" placeholder="40" onChange={updateField} />
                </div>
              </section>

              <section className="space-y-3 border-t border-gray-100 pt-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0b67b2]">Scan</p>
                <FormField id="searchPhrase" label="Search phrase" value={data.searchPhrase} error={errors.searchPhrase} placeholder="frameless shower glass near me" onChange={updateField} />
                <FormField id="market" label="Market" value={data.market} error={errors.market} placeholder="Charlotte, NC" onChange={updateField} />
                <FormField id="averagePosition" label="Average Google Maps position" value={data.averagePosition} error={errors.averagePosition} type="number" min="0.1" step="0.01" placeholder="3.96" onChange={updateField} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField id="gridSize" label="Grid size" value={data.gridSize} error={errors.gridSize} placeholder="7 × 7" onChange={updateField} />
                  <FormField id="radius" label="Radius (miles)" value={data.radius} error={errors.radius} type="number" min="0.1" step="0.1" placeholder="2.5" onChange={updateField} />
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
                <p className="text-xs text-gray-500">Exports at 1080 × 1350 PNG</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${previewReady ? "bg-emerald-100 text-emerald-700" : "bg-white text-gray-500"}`}>
                {previewReady ? "Ready to download" : "Draft"}
              </span>
            </div>
            <div ref={previewViewportRef} className="w-full overflow-hidden rounded-lg" data-testid="report-preview-viewport">
              <div style={{ width: REPORT_WIDTH * previewScale, height: REPORT_HEIGHT * previewScale }}>
                <div style={{ width: REPORT_WIDTH, height: REPORT_HEIGHT, transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
                  <LocalVisibilityReportTemplate ref={reportRef} data={data} />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
