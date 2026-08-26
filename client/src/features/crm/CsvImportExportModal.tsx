import {
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle, Archive, CheckCircle2, ChevronDown, ClipboardPaste, Download, Flag, ImagePlus, SkipForward, Upload, ZoomIn,
} from "lucide-react";
import { useAdminLang } from "@/i18n/LanguageContext";
import LocalVisibilityReportTemplate from "@features/local-visibility-report/LocalVisibilityReportTemplate";
import { renderLocalVisibilityReportBlob } from "@features/local-visibility-report/exportReport";
import type { LocalVisibilityReportData } from "@features/local-visibility-report/types";
import {
  LOCAL_FALCON_LEAD_CLASSIFICATIONS,
  type LocalFalconLeadClassification,
} from "@shared/leadClassification";

interface ImportRowResult {
  row: number;
  status: "imported" | "skipped" | "error";
  reason?: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  details: ImportRowResult[];
}

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
  defaultEntity?: "local_falcon" | "leads" | "contacts";
}

interface AssignableUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface LocalFalconPreviewRow {
  row: number;
  placeId: string;
  companyName: string;
  address: string;
  heatmapFile: string;
  scanSpec: { grid_size: string; radius_miles: number };
  heatmapPreviewDataUrl: string | null;
  heatmapSha256: string;
  heatmapSourceUrl: string | null;
  mapPresentation: {
    mapZoom: number;
    mapPosition: { x: number; y: number };
  };
  reportData: LocalVisibilityReportData;
  outcome: "new" | "variation" | "existing" | "flagged";
  reason?: string;
  matches?: Array<{ companyName: string; reasons: string[] }>;
}

interface LocalFalconPreview {
  batchId: string;
  market: { city: string; state: string };
  trade: string;
  keyword: string;
  scanSpec: { grid_size: string; radius_miles: number };
  scanSpecs: Array<{ grid_size: string; radius_miles: number }>;
  batchAlreadyImported: boolean;
  newCount: number;
  variationCount: number;
  existingCount: number;
  flaggedCount: number;
  sourceMode: "local_falcon" | "zip" | "fallback";
  rows: LocalFalconPreviewRow[];
}

interface LocalFalconImageFailure {
  placeId: string;
  companyName: string;
  reportKey: string;
  reason: string;
}

type PastedLocalFalconJson = {
  kind: "batch" | "competitors";
  batchId: string;
  requiresCompetitors: boolean;
};

function classifyPastedLocalFalconJson(value: unknown): PastedLocalFalconJson | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (payload.batch && typeof payload.batch === "object" && !Array.isArray(payload.batch) && Array.isArray(payload.prospects)) {
    const batchId = (payload.batch as Record<string, unknown>).batch_id;
    if (typeof batchId !== "string" || !batchId.trim()) return null;
    return { kind: "batch", batchId: batchId.trim(), requiresCompetitors: payload.workflow === "scale_first_v2" };
  }
  if (payload.reports && typeof payload.reports === "object" && !Array.isArray(payload.reports)) {
    const batchId = payload.batch_id;
    if (typeof batchId !== "string" || !batchId.trim()) return null;
    return { kind: "competitors", batchId: batchId.trim(), requiresCompetitors: false };
  }
  return null;
}

function FramedReportPreview({
  data,
  mapPresentation,
  reportRef,
  onInspect,
}: {
  data: LocalVisibilityReportData;
  mapPresentation: LocalFalconPreviewRow["mapPresentation"];
  reportRef?: (element: HTMLDivElement | null) => void;
  onInspect: () => void;
}) {
  return (
    <div className="relative h-[720px] w-[270px] overflow-hidden rounded-lg border bg-white shadow-sm" aria-label="Final report framing preview">
      <div
        className="pointer-events-auto absolute right-2 top-2 z-20"
        data-testid="local-falcon-scan-magnifier-trigger-position"
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-9 w-9 border bg-white/95 shadow-md"
          onClick={onInspect}
          aria-label={`Magnify scan for ${data.businessName}`}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
      <div className="h-[2880px] w-[1080px] origin-top-left scale-[0.25] pointer-events-none">
        <LocalVisibilityReportTemplate
          ref={reportRef}
          data={data}
          mapZoom={mapPresentation.mapZoom}
          mapPosition={mapPresentation.mapPosition}
        />
      </div>
    </div>
  );
}

function ScanMagnifierDialog({ row, onClose }: { row: LocalFalconPreviewRow; onClose: () => void }) {
  const [zoom, setZoom] = useState<"fit" | "100" | "200">("fit");
  const imageUrl = row.heatmapPreviewDataUrl ?? row.reportData.heatmapImageUrl;
  const zoomWidth = zoom === "100" ? "100%" : zoom === "200" ? "200%" : undefined;

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[94dvh] sm:max-w-5xl" data-testid="local-falcon-scan-magnifier">
        <DialogHeader>
          <DialogTitle>{row.companyName} scan</DialogTitle>
          <DialogDescription>Inspect the original Local Falcon heatmap before confirming this prospect.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2" aria-label="Scan zoom controls">
          {(["fit", "100", "200"] as const).map((level) => (
            <Button
              key={level}
              type="button"
              size="sm"
              variant={zoom === level ? "default" : "outline"}
              onClick={() => setZoom(level)}
              aria-pressed={zoom === level}
              data-testid={`button-scan-zoom-${level}`}
            >
              {level === "fit" ? "Fit" : `${level}%`}
            </Button>
          ))}
        </div>
        <div className="h-[72dvh] overflow-auto rounded-lg border bg-slate-100 p-3" data-testid="local-falcon-scan-magnifier-viewport">
          <img
            src={imageUrl}
            alt={`Local Falcon scan for ${row.companyName}`}
            className={zoom === "fit" ? "mx-auto block max-h-full max-w-full object-contain" : "mx-auto block max-w-none"}
            style={zoomWidth ? { width: zoomWidth } : undefined}
            data-testid="local-falcon-scan-magnifier-image"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} data-testid="button-close-scan-magnifier">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CsvImportModal({ open, onClose, defaultEntity = "local_falcon" }: CsvImportModalProps) {
  const { toast } = useToast();
  const { t } = useAdminLang();
  const queryClient = useQueryClient();
  const packageInputRef = useRef<HTMLInputElement>(null);
  const heatmapInputRef = useRef<HTMLInputElement>(null);
  const reportRefs = useRef(new Map<string, HTMLDivElement>());

  const [entityType, setEntityType] = useState<"local_falcon" | "leads" | "contacts">(defaultEntity);
  const [file, setFile] = useState<File | null>(null);
  const [competitorsFile, setCompetitorsFile] = useState<File | null>(null);
  const [heatmapFiles, setHeatmapFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<"idle" | "loading" | "preview" | "done">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<LocalFalconPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState("");
  const [leadClassification, setLeadClassification] = useState<LocalFalconLeadClassification | "">("");
  const [approvedFlagged, setApprovedFlagged] = useState<Set<string>>(new Set());
  const [confirmedPreviews, setConfirmedPreviews] = useState<Set<string>>(new Set());
  const [imageFailures, setImageFailures] = useState<LocalFalconImageFailure[]>([]);
  const [isGeneratingSnapshots, setIsGeneratingSnapshots] = useState(false);
  const [pastedBatchId, setPastedBatchId] = useState<string | null>(null);
  const [pastedCompetitorBatchId, setPastedCompetitorBatchId] = useState<string | null>(null);
  const [pastedBatchRequiresCompetitors, setPastedBatchRequiresCompetitors] = useState(false);
  const [magnifiedRow, setMagnifiedRow] = useState<LocalFalconPreviewRow | null>(null);

  const { data: assignableUsers = [] } = useQuery<AssignableUser[]>({
    queryKey: ["/api/crm/leads/assignable-users"],
    enabled: open && entityType === "local_falcon",
  });
  const salesReps = assignableUsers.filter((user) => user.role === "sales_rep");
  const isJsonPackage = file?.name.toLowerCase().endsWith(".json") ?? false;
  const pastedBatchMismatch = Boolean(pastedBatchId && pastedCompetitorBatchId && pastedBatchId !== pastedCompetitorBatchId);
  const pastedSidecarMissing = Boolean(file && isJsonPackage && pastedBatchRequiresCompetitors && !competitorsFile);

  const clearImportState = () => {
    setFile(null);
    setCompetitorsFile(null);
    setHeatmapFiles([]);
    setResult(null);
    setPreview(null);
    setImportError(null);
    setAssignedTo("");
    setLeadClassification("");
    setApprovedFlagged(new Set());
    setConfirmedPreviews(new Set());
    setImageFailures([]);
    setIsGeneratingSnapshots(false);
    setPastedBatchId(null);
    setPastedCompetitorBatchId(null);
    setPastedBatchRequiresCompetitors(false);
    setMagnifiedRow(null);
    reportRefs.current.clear();
    setPhase("idle");
  };

  const setPrimaryFile = (nextFile: File | null) => {
    setFile(nextFile);
    setCompetitorsFile(null);
    setHeatmapFiles([]);
    setPreview(null);
    setResult(null);
    setImportError(null);
    setImageFailures([]);
    setPastedBatchId(null);
    setPastedCompetitorBatchId(null);
    setPastedBatchRequiresCompetitors(false);
  };

  const setLocalFalconPackageFiles = (files: File[]) => {
    const zip = files.find((candidate) => /\.zip$/i.test(candidate.name));
    if (zip) {
      setPrimaryFile(zip);
      return;
    }

    const batch = files.find(
      (candidate) => /\.json$/i.test(candidate.name) && candidate.name.toLowerCase() !== "competitors.json",
    );
    if (batch) {
      setPrimaryFile(batch);
      setCompetitorsFile(files.find((candidate) => candidate.name.toLowerCase() === "competitors.json") ?? null);
      return;
    }
    if (files.some((candidate) => candidate.name.toLowerCase() === "competitors.json")) {
      setImportError("Choose batch.json together with competitors.json.");
      return;
    }
    setImportError("Choose batch.json or one scan ZIP package.");
  };

  const addHeatmaps = (files: File[]) => {
    const images = files.filter((candidate) => /^image\/(png|jpeg|webp)$/.test(candidate.type) || /\.(png|jpe?g|webp)$/i.test(candidate.name));
    setHeatmapFiles((current) => {
      const byName = new Map(current.map((item) => [item.name, item]));
      images.forEach((item) => byName.set(item.name, item));
      return [...byName.values()];
    });
    setImportError(null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (phase === "loading") return;
    const dropped = Array.from(event.dataTransfer.files);
    setLocalFalconPackageFiles(dropped);
  };

  const handlePackagePaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (phase === "loading") return;

    const clipboardText = event.clipboardData.getData("text/plain").trim();
    if (clipboardText) {
      const fencedMatch = clipboardText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
      const jsonText = (fencedMatch?.[1] ?? clipboardText).trim();
      try {
        const artifact = classifyPastedLocalFalconJson(JSON.parse(jsonText));
        if (!artifact) {
          setImportError("The pasted JSON is not a recognized batch.json or competitors.json artifact.");
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const pastedFile = new File([jsonText], `${artifact.kind === "batch" ? "batch" : "competitors"}.json`, {
          type: "application/json",
          lastModified: Date.now(),
        });
        if (artifact.kind === "batch") {
          setFile(pastedFile);
          setHeatmapFiles([]);
          setPastedBatchId(artifact.batchId);
          setPastedBatchRequiresCompetitors(artifact.requiresCompetitors);
          setImportError(pastedCompetitorBatchId && pastedCompetitorBatchId !== artifact.batchId
            ? `Batch ID mismatch: batch.json is ${artifact.batchId}, but competitors.json is ${pastedCompetitorBatchId}.`
            : null);
        } else {
          setCompetitorsFile(pastedFile);
          setPastedCompetitorBatchId(artifact.batchId);
          setImportError(pastedBatchId && pastedBatchId !== artifact.batchId
            ? `Batch ID mismatch: batch.json is ${pastedBatchId}, but competitors.json is ${artifact.batchId}.`
            : null);
        }
        setPreview(null);
        setResult(null);
        setImageFailures([]);
        return;
      } catch {
        // Copied files can include non-JSON text metadata, so check files next.
      }
    }

    const pastedFiles = Array.from(event.clipboardData.files);
    if (pastedFiles.some((candidate) => /\.(zip|json)$/i.test(candidate.name))) {
      event.preventDefault();
      event.stopPropagation();
      setLocalFalconPackageFiles(pastedFiles);
      return;
    }

    if (clipboardText) {
      setImportError("The pasted clipboard text is not valid JSON.");
      return;
    }
    setImportError("Paste JSON text or a copied ZIP/JSON file. Images are requested separately only if Local Falcon retrieval fails.");
  };

  const buildPackageForm = () => {
    if (!file) throw new Error("Choose a package first");
    const form = new FormData();
    form.append("package", file);
    if (competitorsFile) form.append("competitors", competitorsFile, competitorsFile.name);
    heatmapFiles.forEach((heatmap) => form.append("heatmaps", heatmap, heatmap.name));
    return form;
  };

  const handleImport = async () => {
    if (!file) return;
    setPhase("loading");
    setImportError(null);
    try {
      if (entityType === "local_falcon") {
        const response = await fetch("/api/crm/leads/import-local-falcon/preview", {
          method: "POST",
          credentials: "include",
          body: buildPackageForm(),
        });
        const body = await response.json();
        if (!response.ok) {
          if (body.code === "LOCAL_FALCON_IMAGE_FETCH_FAILED" && Array.isArray(body.failures)) {
            setImageFailures(body.failures);
          }
          throw new Error(body.message ?? "Preview failed");
        }
        setPreview(body);
        setImageFailures([]);
        setApprovedFlagged(new Set());
        setConfirmedPreviews(new Set());
        setPhase("preview");
        return;
      }

      const csvText = await file.text();
      const endpoint = entityType === "leads" ? "/api/crm/leads/import-csv" : "/api/crm/contacts/import-csv";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        credentials: "include",
        body: csvText,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Import failed");
      setResult(data);
      setPhase("done");
      if (entityType === "leads") queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      toast({ title: "Import complete", description: `${data.imported} imported · ${data.skipped} skipped · ${data.errors} errors` });
    } catch (error: any) {
      setImportError(error.message ?? "Import failed");
      setPhase("idle");
    }
  };

  const handleConfirmLocalFalcon = async () => {
    if (!preview) return;
    if (!leadClassification) {
      setImportError("Choose SAB or Location Based before importing.");
      return;
    }
    setImportError(null);
    setIsGeneratingSnapshots(true);
    try {
      const form = buildPackageForm();
      if (assignedTo) form.append("assignedTo", assignedTo);
      form.append("leadClassification", leadClassification);
      form.append("approvedFlaggedPlaceIds", JSON.stringify([...approvedFlagged]));
      form.append("previewHeatmapChecksums", JSON.stringify(Object.fromEntries(
        preview.rows.map((row) => [row.placeId, row.heatmapSha256]),
      )));
      const selectedRows = preview.rows.filter(
        (row) =>
          row.outcome === "new"
          || row.outcome === "variation"
          || (row.outcome === "flagged" && approvedFlagged.has(row.placeId)),
      );
      for (const row of selectedRows) {
        const blob = await renderLocalVisibilityReportBlob(reportRefs.current.get(row.placeId) ?? null);
        form.append("snapshots", blob, `${row.placeId}.png`);
      }
      setPhase("loading");
      const response = await fetch("/api/crm/leads/import-local-falcon/confirm", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "LOCAL_FALCON_IMAGE_FETCH_FAILED" && Array.isArray(data.failures)) {
          setImageFailures(data.failures);
          setPreview(null);
          setPhase("idle");
          setImportError(data.message ?? "Local Falcon image retrieval failed");
          return;
        }
        throw new Error(data.message ?? "Import failed");
      }
      setResult({
        imported: data.imported,
        skipped: data.existingCount + data.flaggedCount - approvedFlagged.size,
        errors: data.automationErrors,
        details: [],
      });
      setPhase("done");
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/local-visibility/prospects"] });
      toast({
        title: "Local Falcon import complete",
        description: `${data.imported} scan reports · ${data.leadsCreated} new leads`,
      });
    } catch (error: any) {
      setImportError(error.message ?? "Import failed");
      setPhase("preview");
    } finally {
      setIsGeneratingSnapshots(false);
    }
  };

  const handleClose = () => {
    clearImportState();
    onClose();
  };

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string, checked: boolean) => {
    setter((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const includedRows = preview?.rows.filter((row) =>
    row.outcome === "new"
    || row.outcome === "variation"
    || (row.outcome === "flagged" && approvedFlagged.has(row.placeId)),
  ) ?? [];
  const confirmedIncludedPreviewCount = includedRows.filter((row) => confirmedPreviews.has(row.placeId)).length;
  const allIncludedPreviewsConfirmed = includedRows.length > 0
    && confirmedIncludedPreviewCount === includedRows.length;
  const someIncludedPreviewsConfirmed = confirmedIncludedPreviewCount > 0
    && !allIncludedPreviewsConfirmed;
  const everyIncludedPreviewConfirmed = includedRows.length > 0
    && allIncludedPreviewsConfirmed;

  const setAllIncludedPreviewsConfirmed = (checked: boolean) => {
    setConfirmedPreviews((current) => {
      const next = new Set(current);
      includedRows.forEach((row) => {
        if (checked) next.add(row.placeId);
        else next.delete(row.placeId);
      });
      return next;
    });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-6xl" data-testid="csv-import-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="h-4 w-4" /> Import prospects</DialogTitle>
          <DialogDescription className="sr-only">
            Import qualified Local Falcon prospects from JSON, or import leads and contacts from CSV.
          </DialogDescription>
        </DialogHeader>

        {(phase === "idle" || phase === "loading") && (
          <div className="space-y-4 py-1">
            <div className="flex gap-2">
              {(["local_falcon", "leads", "contacts"] as const).map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant={entityType === type ? "default" : "outline"}
                  disabled={phase === "loading"}
                  onClick={() => { setEntityType(type); clearImportState(); }}
                  data-testid={`button-entity-${type.replace("_", "-")}`}
                >
                  {type === "local_falcon" ? "Local Falcon" : type === "leads" ? "Leads" : "Contacts"}
                </Button>
              ))}
            </div>

            {entityType === "local_falcon" ? (
              <>
                <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Qualified Local Falcon prospects</p>
                  <p className="mt-1">Paste the Scale-First Manifest v2 <code>batch.json</code> and <code>competitors.json</code> artifacts one at a time, or choose them together. The CRM retrieves each official map automatically from its <code>report_key</code>.</p>
                </div>
                <div
                  role="group"
                  aria-label="Paste, drop, or choose a Local Falcon package"
                  tabIndex={0}
                  className="flex min-h-44 cursor-text flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center outline-none transition hover:border-blue-500 hover:bg-blue-50/40 focus-visible:border-blue-500 focus-visible:bg-blue-50/40 focus-visible:ring-2 focus-visible:ring-blue-500"
                  onPaste={handlePackagePaste}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                  onClick={(event) => event.currentTarget.focus()}
                  data-testid="local-falcon-package-dropzone"
                >
                  <ClipboardPaste className="mb-3 h-9 w-9 text-blue-600" />
                  <p className="font-semibold text-slate-900">Copy and paste both JSON artifacts</p>
                  <p className="mt-1 text-sm text-slate-500">Paste batch.json and competitors.json one at a time, in either order; choosing both files or one ZIP also works</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4 bg-white"
                    disabled={phase === "loading"}
                    onClick={(event) => {
                      event.stopPropagation();
                      packageInputRef.current?.click();
                    }}
                  >
                    Choose v2 JSON files or ZIP
                  </Button>
                  <Input
                    ref={packageInputRef}
                    type="file"
                    accept=".zip,.json,application/zip,application/json"
                    multiple
                    className="hidden"
                    onChange={(event) => setLocalFalconPackageFiles(Array.from(event.target.files ?? []))}
                    data-testid="input-csv-file"
                  />
                </div>
                {file && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                      <Archive className="h-5 w-5 text-blue-600" />
                      <div><p className="font-medium" data-testid="local-falcon-primary-file">{file.name}</p><p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div>
                    </div>
                  </div>
                )}
                {competitorsFile && (
                  <p className="mt-2 text-xs text-slate-600">
                    Competitor comparison: <span className="font-medium" data-testid="local-falcon-competitors-file">{competitorsFile.name}</span>
                  </p>
                )}
                {pastedSidecarMissing && (
                  <p className="mt-2 text-xs font-medium text-amber-700">Batch loaded. Copy competitors.json and paste it into the same box next.</p>
                )}
                {file && isJsonPackage && (
                  <div
                    className={`rounded-lg border border-dashed p-4 ${
                      imageFailures.length > 0
                        ? "border-amber-400 bg-amber-50"
                        : "border-slate-300 bg-slate-50"
                    }`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => { event.preventDefault(); addHeatmaps(Array.from(event.dataTransfer.files)); }}
                    data-testid="local-falcon-image-overrides"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <ImagePlus className={`mt-0.5 h-5 w-5 ${imageFailures.length > 0 ? "text-amber-700" : "text-slate-600"}`} />
                        <div>
                          <p className={`text-sm font-medium ${imageFailures.length > 0 ? "text-amber-950" : "text-slate-900"}`}>
                            Map image overrides
                          </p>
                          <p className={`text-xs ${imageFailures.length > 0 ? "text-amber-800" : "text-slate-600"}`}>
                            Optional: add an original Local Falcon image named <code>&lt;place_id&gt;.png</code>. It replaces the automatic download, including a defective image that Local Falcon reports as successful.
                          </p>
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="bg-white" disabled={phase === "loading"} onClick={() => heatmapInputRef.current?.click()}>
                        Choose map overrides
                      </Button>
                    </div>
                    <Input
                      ref={heatmapInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      className="hidden"
                      onChange={(event) => addHeatmaps(Array.from(event.target.files ?? []))}
                      data-testid="input-local-falcon-map-overrides"
                    />
                    {imageFailures.length > 0 && (
                      <div className="mt-3 space-y-1" data-testid="local-falcon-image-fallback">
                        {imageFailures.map((failure) => (
                          <p key={failure.placeId} className="text-xs text-amber-900">
                            <span className="font-semibold">{failure.companyName}:</span> name the file <code>{failure.placeId}.png</code>
                            <span className="block text-amber-800">Last error: {failure.reason}</span>
                          </p>
                        ))}
                      </div>
                    )}
                    {heatmapFiles.length > 0 && (
                      <div className="mt-3 text-xs text-green-700">
                        <p className="font-medium">{heatmapFiles.length} map override{heatmapFiles.length === 1 ? "" : "s"} selected</p>
                        <p className="mt-1 break-all">{heatmapFiles.map((heatmap) => heatmap.name).join(", ")}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div>
                <Label htmlFor="csv-file-input">CSV file (max 5 MB)</Label>
                <Input id="csv-file-input" type="file" accept=".csv,text/csv,text/plain" onChange={(event) => setPrimaryFile(event.target.files?.[0] ?? null)} className="mt-1.5" disabled={phase === "loading"} data-testid="input-csv-file" />
              </div>
            )}
            {importError && <p className="flex items-center gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{importError}</p>}
          </div>
        )}

        {phase === "preview" && preview && (
          <div className="space-y-5" data-testid="local-falcon-import-preview">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">Batch {preview.batchId}</p>
                <p className="text-sm text-slate-500">
                  {preview.market.city}, {preview.market.state} · {preview.trade} · {(preview.scanSpecs ?? [preview.scanSpec]).map((spec) => `${spec.grid_size} / ${spec.radius_miles} miles`).join("; ")}
                </p>
              </div>
              <div className="flex gap-2 text-center text-xs">
                <Badge className="bg-green-100 text-green-700">{preview.newCount} new</Badge>
                {preview.variationCount > 0 && (
                  <Badge className="bg-blue-100 text-blue-700">{preview.variationCount} variations</Badge>
                )}
                <Badge className="bg-yellow-100 text-yellow-700">{preview.flaggedCount} flagged</Badge>
                <Badge variant="secondary">{preview.existingCount} existing</Badge>
              </div>
            </div>

            {includedRows.length > 0 && (
              <div className="space-y-3">
                <div className="grid gap-2 md:grid-cols-[180px_1fr] md:items-center">
                  <Label>Lead type <span className="text-red-500">*</span></Label>
                  <div>
                    <Select
                      value={leadClassification}
                      onValueChange={(value) => setLeadClassification(value as LocalFalconLeadClassification)}
                    >
                      <SelectTrigger data-testid="select-local-falcon-lead-type">
                        <SelectValue placeholder="Choose SAB or Location Based" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCAL_FALCON_LEAD_CLASSIFICATIONS.map((classification) => (
                          <SelectItem key={classification.value} value={classification.value}>
                            {classification.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-slate-500">
                      This required tag is applied to every included company in the batch.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-[180px_1fr] md:items-center">
                  <Label>Assign this batch to</Label>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger data-testid="select-local-falcon-assignee"><SelectValue placeholder="Select appointment setter" /></SelectTrigger>
                    <SelectContent>{salesReps.map((rep) => <SelectItem key={rep.id} value={rep.id}>{rep.name} · {rep.email}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {includedRows.length > 1 && (
              <label
                className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-medium text-blue-950"
                data-testid="confirm-all-local-falcon-previews"
              >
                <Checkbox
                  checked={allIncludedPreviewsConfirmed ? true : someIncludedPreviewsConfirmed ? "indeterminate" : false}
                  onCheckedChange={(value) => setAllIncludedPreviewsConfirmed(value === true)}
                  data-testid="checkbox-confirm-all-local-falcon-previews"
                />
                <span>
                  Confirm all {includedRows.length} included reports
                  <span className="mt-0.5 block text-xs font-normal text-blue-800">
                    I reviewed every included image and confirmed it belongs to the listed company with all 49 grid dots visible.
                  </span>
                </span>
              </label>
            )}

            <div className="space-y-4">
              {preview.rows.map((row) => {
                const isIncluded = row.outcome === "new" || row.outcome === "variation" || approvedFlagged.has(row.placeId);
                return (
                  <div key={row.placeId} className="rounded-xl border p-4" data-testid={`local-falcon-preview-row-${row.row}`}>
                    <div className="grid gap-5 lg:grid-cols-[1fr_270px]">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{row.companyName}</p>
                          <Badge variant={row.outcome === "new" || row.outcome === "variation" ? "default" : "outline"}>
                            {row.outcome}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500">{row.address}</p>
                        <p className="text-xs font-medium text-slate-600">Canonical scan: {(row.scanSpec ?? preview.scanSpec).grid_size} / {(row.scanSpec ?? preview.scanSpec).radius_miles} miles</p>
                        {row.heatmapSourceUrl ? (
                          <a href={row.heatmapSourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                            Official map retrieved automatically from Local Falcon
                          </a>
                        ) : (
                          <p className="font-mono text-xs text-slate-400">{row.heatmapFile}</p>
                        )}
                        {row.reason && <p className="text-sm text-slate-600">{row.reason}</p>}
                        {row.matches?.map((match) => <p key={match.companyName} className="text-sm text-amber-700"><Flag className="mr-1 inline h-4 w-4" />Possible match: {match.companyName} ({match.reasons.join(", ")})</p>)}
                        {row.outcome === "flagged" && (
                          <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={approvedFlagged.has(row.placeId)} onCheckedChange={(value) => toggleSet(setApprovedFlagged, row.placeId, value === true)} />Import this flagged prospect</label>
                        )}
                        {row.outcome === "existing" ? (
                          <p className="flex items-center gap-2 text-sm text-slate-500"><SkipForward className="h-4 w-4" />This row will be skipped.</p>
                        ) : isIncluded ? (
                          <label className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-950">
                            <Checkbox
                              checked={confirmedPreviews.has(row.placeId)}
                              onCheckedChange={(value) => toggleSet(setConfirmedPreviews, row.placeId, value === true)}
                              data-testid={`checkbox-confirm-local-falcon-preview-${row.row}`}
                            />
                            <span>I confirmed the image belongs to this company and all 49 grid dots are visible in the framed report.</span>
                          </label>
                        ) : null}
                      </div>
                      <FramedReportPreview
                        data={row.reportData}
                        mapPresentation={row.mapPresentation}
                        onInspect={() => setMagnifiedRow(row)}
                        reportRef={(element) => {
                          if (element) reportRefs.current.set(row.placeId, element);
                          else reportRefs.current.delete(row.placeId);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {importError && <p className="text-sm text-red-600">{importError}</p>}
          </div>
        )}

        {phase === "done" && result && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-green-50 p-3"><p className="text-2xl font-bold text-green-600">{result.imported}</p><p className="text-xs text-slate-500">Imported</p></div>
              <div className="rounded-lg bg-yellow-50 p-3"><p className="text-2xl font-bold text-yellow-600">{result.skipped}</p><p className="text-xs text-slate-500">Skipped</p></div>
              <div className="rounded-lg bg-red-50 p-3"><p className="text-2xl font-bold text-red-600">{result.errors}</p><p className="text-xs text-slate-500">Errors</p></div>
            </div>
            {result.errors === 0 && <p className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" />Import completed successfully.</p>}
          </div>
        )}

        <DialogFooter>
          {phase === "done" ? (
            <><Button variant="outline" onClick={clearImportState}>Import more</Button><Button onClick={handleClose}>Done</Button></>
          ) : phase === "preview" ? (
            <><Button variant="outline" onClick={clearImportState} disabled={isGeneratingSnapshots}>Choose another package</Button><Button onClick={handleConfirmLocalFalcon} disabled={preview?.batchAlreadyImported || (includedRows.length > 0 && (!assignedTo || !leadClassification)) || !everyIncludedPreviewConfirmed || isGeneratingSnapshots} data-testid="button-confirm-local-falcon-import">{isGeneratingSnapshots ? "Generating snapshots…" : "Import reports"}</Button></>
          ) : (
            <><Button variant="outline" onClick={handleClose} disabled={phase === "loading"}>Cancel</Button><Button onClick={handleImport} disabled={!file || phase === "loading" || pastedBatchMismatch || pastedSidecarMissing} data-testid="button-start-import">{phase === "loading" ? t.crm.importing : imageFailures.length > 0 && heatmapFiles.length === 0 ? "Retry automatic retrieval" : "Review import"}</Button></>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {magnifiedRow && <ScanMagnifierDialog key={magnifiedRow.placeId} row={magnifiedRow} onClose={() => setMagnifiedRow(null)} />}
    </>
  );
}

export async function triggerCsvExport(type: "leads" | "contacts", onError: (msg: string) => void): Promise<void> {
  try {
    const response = await fetch(type === "leads" ? "/api/crm/leads/export-csv" : "/api/crm/contacts/export-csv", { credentials: "include" });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Export failed" }));
      throw new Error(error.message ?? "Export failed");
    }
    const blobUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = `${type}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (error: any) {
    onError(error.message ?? "Export failed");
  }
}

export function CsvExportDropdown({ className }: { className?: string }) {
  const { toast } = useToast();
  const { t } = useAdminLang();
  const [exporting, setExporting] = useState(false);
  const handleExport = async (type: "leads" | "contacts") => {
    setExporting(true);
    await triggerCsvExport(type, (message) => toast({ title: t.crm.exportError, description: message, variant: "destructive" }));
    setExporting(false);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={exporting} className={className} data-testid="button-export-dropdown"><Download className="mr-1.5 h-4 w-4" />{t.crm.export}<ChevronDown className="ml-1 h-3 w-3" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("leads")}><Download className="mr-2 h-4 w-4" />{t.crm.exportLeads}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("contacts")}><Download className="mr-2 h-4 w-4" />{t.crm.exportContacts}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
