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
  AlertCircle, Archive, CheckCircle2, ChevronDown, ClipboardPaste, Download, Flag, ImagePlus, SkipForward, Upload,
} from "lucide-react";
import { useAdminLang } from "@/i18n/LanguageContext";
import LocalVisibilityReportTemplate from "@features/local-visibility-report/LocalVisibilityReportTemplate";
import { renderLocalVisibilityReportBlob } from "@features/local-visibility-report/exportReport";
import type { LocalVisibilityReportData } from "@features/local-visibility-report/types";

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
  heatmapPreviewDataUrl: string | null;
  heatmapSha256: string;
  heatmapSourceUrl: string | null;
  mapPresentation: {
    mapZoom: number;
    mapPosition: { x: number; y: number };
  };
  reportData: LocalVisibilityReportData;
  outcome: "new" | "existing" | "flagged";
  reason?: string;
  matches?: Array<{ companyName: string; reasons: string[] }>;
}

interface LocalFalconPreview {
  batchId: string;
  market: { city: string; state: string };
  trade: string;
  keyword: string;
  scanSpec: { grid_size: string; radius_miles: number };
  batchAlreadyImported: boolean;
  newCount: number;
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

function FramedReportPreview({
  data,
  mapPresentation,
  reportRef,
}: {
  data: LocalVisibilityReportData;
  mapPresentation: LocalFalconPreviewRow["mapPresentation"];
  reportRef?: (element: HTMLDivElement | null) => void;
}) {
  return (
    <div className="h-[480px] w-[270px] overflow-hidden rounded-lg border bg-white shadow-sm" aria-label="Final report framing preview">
      <div className="h-[1920px] w-[1080px] origin-top-left scale-[0.25] pointer-events-none">
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

export function CsvImportModal({ open, onClose, defaultEntity = "local_falcon" }: CsvImportModalProps) {
  const { toast } = useToast();
  const { t } = useAdminLang();
  const queryClient = useQueryClient();
  const packageInputRef = useRef<HTMLInputElement>(null);
  const heatmapInputRef = useRef<HTMLInputElement>(null);
  const reportRefs = useRef(new Map<string, HTMLDivElement>());

  const [entityType, setEntityType] = useState<"local_falcon" | "leads" | "contacts">(defaultEntity);
  const [file, setFile] = useState<File | null>(null);
  const [heatmapFiles, setHeatmapFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<"idle" | "loading" | "preview" | "done">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<LocalFalconPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState("");
  const [approvedFlagged, setApprovedFlagged] = useState<Set<string>>(new Set());
  const [confirmedPreviews, setConfirmedPreviews] = useState<Set<string>>(new Set());
  const [imageFailures, setImageFailures] = useState<LocalFalconImageFailure[]>([]);

  const { data: assignableUsers = [] } = useQuery<AssignableUser[]>({
    queryKey: ["/api/crm/leads/assignable-users"],
    enabled: open && entityType === "local_falcon",
  });
  const salesReps = assignableUsers.filter((user) => user.role === "sales_rep");

  const clearImportState = () => {
    setFile(null);
    setHeatmapFiles([]);
    setResult(null);
    setPreview(null);
    setImportError(null);
    setAssignedTo("");
    setApprovedFlagged(new Set());
    setConfirmedPreviews(new Set());
    setImageFailures([]);
    reportRefs.current.clear();
    setPhase("idle");
  };

  const setPrimaryFile = (nextFile: File | null) => {
    setFile(nextFile);
    setHeatmapFiles([]);
    setPreview(null);
    setResult(null);
    setImportError(null);
    setImageFailures([]);
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
    const primary = dropped.find((candidate) => /\.(zip|json)$/i.test(candidate.name));
    if (primary) setPrimaryFile(primary);
    if (!primary) setImportError("Drop a ZIP package or JSON manifest, or paste JSON text.");
  };

  const handlePackagePaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    if (phase === "loading") return;

    const clipboardText = event.clipboardData.getData("text/plain").trim();
    if (clipboardText) {
      const fencedMatch = clipboardText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
      const jsonText = (fencedMatch?.[1] ?? clipboardText).trim();
      try {
        JSON.parse(jsonText);
        event.preventDefault();
        event.stopPropagation();
        setPrimaryFile(new File([jsonText], "batch.json", {
          type: "application/json",
          lastModified: Date.now(),
        }));
        return;
      } catch {
        // Copied files can include non-JSON text metadata, so check files next.
      }
    }

    const pastedFiles = Array.from(event.clipboardData.files);
    const primary = pastedFiles.find((candidate) => /\.(zip|json)$/i.test(candidate.name));

    if (primary) {
      event.preventDefault();
      event.stopPropagation();
      setPrimaryFile(primary);
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
    if (!preview || !assignedTo) return;
    setPhase("loading");
    setImportError(null);
    try {
      const form = buildPackageForm();
      form.append("assignedTo", assignedTo);
      form.append("approvedFlaggedPlaceIds", JSON.stringify([...approvedFlagged]));
      form.append("previewHeatmapChecksums", JSON.stringify(Object.fromEntries(
        preview.rows.map((row) => [row.placeId, row.heatmapSha256]),
      )));
      const selectedRows = preview.rows.filter(
        (row) => row.outcome === "new" || (row.outcome === "flagged" && approvedFlagged.has(row.placeId)),
      );
      for (const row of selectedRows) {
        const blob = await renderLocalVisibilityReportBlob(reportRefs.current.get(row.placeId) ?? null);
        form.append("snapshots", blob, `${row.placeId}.png`);
      }
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
      setResult({ imported: data.imported, skipped: data.existingCount + data.flaggedCount - approvedFlagged.size, errors: data.automationErrors, details: [] });
      setPhase("done");
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/local-visibility/prospects"] });
      toast({ title: "Local Falcon import complete", description: `${data.imported} assigned leads · ${data.tasksCreated} Contact Lead tasks` });
    } catch (error: any) {
      setImportError(error.message ?? "Import failed");
      setPhase("preview");
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

  const includedRows = preview?.rows.filter((row) => row.outcome === "new" || (row.outcome === "flagged" && approvedFlagged.has(row.placeId))) ?? [];
  const everyIncludedPreviewConfirmed = includedRows.length > 0 && includedRows.every((row) => confirmedPreviews.has(row.placeId));

  return (
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
                  <p className="mt-1">Paste the canonical JSON manifest. The CRM retrieves each official map automatically from its <code>report_key</code>. ZIP packages remain available as a fallback.</p>
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
                  <p className="font-semibold text-slate-900">Click this box, then press Ctrl+V or ⌘V</p>
                  <p className="mt-1 text-sm text-slate-500">Paste JSON text or a copied JSON file · ZIP fallback also supported</p>
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
                    Choose JSON or ZIP
                  </Button>
                  <Input
                    ref={packageInputRef}
                    type="file"
                    accept=".zip,.json,application/zip,application/json"
                    className="hidden"
                    onChange={(event) => setPrimaryFile(event.target.files?.[0] ?? null)}
                    data-testid="input-csv-file"
                  />
                </div>
                {file && (
                  <div className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                    <Archive className="h-5 w-5 text-blue-600" />
                    <div><p className="font-medium">{file.name}</p><p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div>
                  </div>
                )}
                {imageFailures.length > 0 && (
                  <div
                    className="rounded-lg border border-dashed border-amber-400 bg-amber-50 p-4"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => { event.preventDefault(); addHeatmaps(Array.from(event.dataTransfer.files)); }}
                    data-testid="local-falcon-image-fallback"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <ImagePlus className="mt-0.5 h-5 w-5 text-amber-700" />
                        <div>
                          <p className="text-sm font-medium text-amber-950">Local Falcon image fallback</p>
                          <p className="text-xs text-amber-800">Automatic retrieval failed only for the prospect{imageFailures.length === 1 ? "" : "s"} below. Add the original image and review again.</p>
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="bg-white" onClick={() => heatmapInputRef.current?.click()}>Choose fallback images</Button>
                    </div>
                    <Input ref={heatmapInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(event) => addHeatmaps(Array.from(event.target.files ?? []))} />
                    <div className="mt-3 space-y-1">
                      {imageFailures.map((failure) => (
                        <p key={failure.placeId} className="text-xs text-amber-900">
                          <span className="font-semibold">{failure.companyName}:</span> name the file <code>{failure.placeId}.png</code>
                        </p>
                      ))}
                    </div>
                    {heatmapFiles.length > 0 && <p className="mt-3 text-xs font-medium text-green-700">{heatmapFiles.length} fallback image{heatmapFiles.length === 1 ? "" : "s"} selected</p>}
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
              <div><p className="font-semibold">Batch {preview.batchId}</p><p className="text-sm text-slate-500">{preview.market.city}, {preview.market.state} · {preview.trade} · {preview.keyword} · {preview.scanSpec.grid_size} / {preview.scanSpec.radius_miles} miles</p></div>
              <div className="flex gap-2 text-center text-xs">
                <Badge className="bg-green-100 text-green-700">{preview.newCount} new</Badge>
                <Badge className="bg-yellow-100 text-yellow-700">{preview.flaggedCount} flagged</Badge>
                <Badge variant="secondary">{preview.existingCount} existing</Badge>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-[180px_1fr] md:items-center">
              <Label>Assign this batch to</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger data-testid="select-local-falcon-assignee"><SelectValue placeholder="Select appointment setter" /></SelectTrigger>
                <SelectContent>{salesReps.map((rep) => <SelectItem key={rep.id} value={rep.id}>{rep.name} · {rep.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              {preview.rows.map((row) => {
                const isIncluded = row.outcome === "new" || approvedFlagged.has(row.placeId);
                return (
                  <div key={row.placeId} className="rounded-xl border p-4" data-testid={`local-falcon-preview-row-${row.row}`}>
                    <div className="grid gap-5 lg:grid-cols-[1fr_270px]">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{row.companyName}</p>
                          <Badge variant={row.outcome === "new" ? "default" : "outline"}>{row.outcome}</Badge>
                        </div>
                        <p className="text-sm text-slate-500">{row.address}</p>
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
                            <Checkbox checked={confirmedPreviews.has(row.placeId)} onCheckedChange={(value) => toggleSet(setConfirmedPreviews, row.placeId, value === true)} />
                            <span>I confirmed the image belongs to this company and all 49 grid dots are visible in the framed report.</span>
                          </label>
                        ) : null}
                      </div>
                      <FramedReportPreview
                        data={row.reportData}
                        mapPresentation={row.mapPresentation}
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
            <><Button variant="outline" onClick={clearImportState}>Choose another package</Button><Button onClick={handleConfirmLocalFalcon} disabled={preview?.batchAlreadyImported || !assignedTo || !everyIncludedPreviewConfirmed} data-testid="button-confirm-local-falcon-import">Import assigned leads</Button></>
          ) : (
            <><Button variant="outline" onClick={handleClose} disabled={phase === "loading"}>Cancel</Button><Button onClick={handleImport} disabled={!file || phase === "loading"} data-testid="button-start-import">{phase === "loading" ? t.crm.importing : "Review import"}</Button></>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
