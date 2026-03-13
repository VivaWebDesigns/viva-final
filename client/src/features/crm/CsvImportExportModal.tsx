import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Download, Upload, ChevronDown, CheckCircle2, AlertCircle, SkipForward } from "lucide-react";
import { useAdminLang } from "@/i18n/LanguageContext";

interface ImportRowResult {
  row: number;
  status: "imported" | "skipped" | "error";
  reason?: string;
  id?: string;
  name?: string;
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
  defaultEntity?: "leads" | "contacts";
}

export function CsvImportModal({ open, onClose, defaultEntity = "leads" }: CsvImportModalProps) {
  const { toast } = useToast();
  const { t } = useAdminLang();
  const queryClient = useQueryClient();

  const [entityType, setEntityType] = useState<"leads" | "contacts">(defaultEntity);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setResult(null);
    setImportError(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setPhase("loading");
    setImportError(null);
    try {
      const csvText = await file.text();
      const endpoint =
        entityType === "leads"
          ? "/api/crm/leads/import-csv"
          : "/api/crm/contacts/import-csv";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        credentials: "include",
        body: csvText,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message ?? "Import failed");
      }
      const data: ImportResult = await response.json();
      setResult(data);
      setPhase("done");
      if (entityType === "leads") {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      }
      toast({
        title: "Import complete",
        description: `${data.imported} imported · ${data.skipped} skipped · ${data.errors} errors`,
      });
    } catch (err: any) {
      setImportError(err.message ?? "Import failed");
      setPhase("idle");
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setImportError(null);
    setPhase("idle");
    onClose();
  };

  const resetForMore = () => {
    setFile(null);
    setResult(null);
    setImportError(null);
    setPhase("idle");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90dvh] overflow-y-auto" data-testid="csv-import-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4" /> {t.crm.importCsv}
          </DialogTitle>
        </DialogHeader>

        {phase !== "done" && (
          <div className="space-y-4 py-1">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={entityType === "leads" ? "default" : "outline"}
                onClick={() => { setEntityType("leads"); setResult(null); setImportError(null); }}
                disabled={phase === "loading"}
                data-testid="button-entity-leads"
              >
                Leads
              </Button>
              <Button
                size="sm"
                variant={entityType === "contacts" ? "default" : "outline"}
                onClick={() => { setEntityType("contacts"); setResult(null); setImportError(null); }}
                disabled={phase === "loading"}
                data-testid="button-entity-contacts"
              >
                Contacts
              </Button>
            </div>

            <div className="rounded-md bg-gray-50 dark:bg-gray-900 border p-3 text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
              {entityType === "leads" ? (
                <>
                  <p>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">Required: </span>
                    <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">title</code>
                  </p>
                  <p>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">Optional: </span>
                    <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
                      source, value, notes, contact_first_name, contact_last_name, contact_email, contact_phone, company_name, company_website
                    </code>
                  </p>
                  <p className="text-gray-500">
                    Contacts and companies are matched by email/phone/name and reused or created automatically.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">Required: </span>
                    <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">first_name</code>
                  </p>
                  <p>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">Optional: </span>
                    <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">
                      last_name, email, phone, alt_phone, title, company_name, preferred_language, notes
                    </code>
                  </p>
                  <p className="text-amber-600 dark:text-amber-400">
                    Rows with a duplicate email are skipped, not updated.
                  </p>
                </>
              )}
            </div>

            <div>
              <Label htmlFor="csv-file-input">CSV file (max 5 MB)</Label>
              <Input
                id="csv-file-input"
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleFileChange}
                className="mt-1.5"
                disabled={phase === "loading"}
                data-testid="input-csv-file"
              />
              {file && (
                <p className="text-xs text-gray-500 mt-1">
                  {file.name} · {(file.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>

            {importError && (
              <p className="text-sm text-red-600 flex items-center gap-1.5" data-testid="text-import-error">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {importError}
              </p>
            )}
          </div>
        )}

        {phase === "done" && result && (
          <div className="py-1 space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3">
                <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.crm.imported}</p>
              </div>
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 p-3">
                <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                <p className="text-xs text-gray-500 mt-0.5">Skipped</p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3">
                <p className="text-2xl font-bold text-red-600">{result.errors}</p>
                <p className="text-xs text-gray-500 mt-0.5">Errors</p>
              </div>
            </div>

            {result.details.some((d) => d.status !== "imported") && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Skipped & error details
                </p>
                <ScrollArea className="h-52 rounded border">
                  <div className="p-3 space-y-1.5">
                    {result.details
                      .filter((d) => d.status !== "imported")
                      .map((d) => (
                        <div
                          key={d.row}
                          className="flex items-start gap-2 text-xs"
                          data-testid={`import-row-result-${d.row}`}
                        >
                          {d.status === "error" ? (
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <SkipForward className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                          )}
                          <span className="font-mono text-gray-400 flex-shrink-0">Row {d.row}</span>
                          <span
                            className={cn(
                              "font-medium",
                              d.status === "error" ? "text-red-600" : "text-yellow-600"
                            )}
                          >
                            [{d.status}]
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">{d.reason}</span>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {result.errors === 0 && result.skipped === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                All rows imported successfully.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {phase === "done" ? (
            <>
              <Button variant="outline" onClick={resetForMore} data-testid="button-import-more">
                Import More
              </Button>
              <Button onClick={handleClose} data-testid="button-import-done">
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={phase === "loading"}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!file || phase === "loading"}
                data-testid="button-start-import"
              >
                {phase === "loading" ? t.crm.importing : t.crm.import}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export async function triggerCsvExport(
  type: "leads" | "contacts",
  onError: (msg: string) => void
): Promise<void> {
  try {
    const url =
      type === "leads"
        ? "/api/crm/leads/export-csv"
        : "/api/crm/contacts/export-csv";
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: "Export failed" }));
      throw new Error(err.message ?? "Export failed");
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().split("T")[0];
    a.href = blobUrl;
    a.download = `${type}-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err: any) {
    onError(err.message ?? "Export failed");
  }
}

interface CsvExportButtonProps {
  className?: string;
}

export function CsvExportDropdown({ className }: CsvExportButtonProps) {
  const { toast } = useToast();
  const { t } = useAdminLang();
  const [exporting, setExporting] = useState(false);

  const handleExport = async (type: "leads" | "contacts") => {
    setExporting(true);
    await triggerCsvExport(type, (msg) =>
      toast({ title: t.crm.exportError, description: msg, variant: "destructive" })
    );
    setExporting(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={exporting}
          className={className}
          data-testid="button-export-dropdown"
        >
          <Download className="w-4 h-4 mr-1.5" />
          {t.crm.export}
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleExport("leads")}
          data-testid="menu-item-export-leads"
        >
          <Download className="w-4 h-4 mr-2" /> {t.crm.exportLeads}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport("contacts")}
          data-testid="menu-item-export-contacts"
        >
          <Download className="w-4 h-4 mr-2" /> {t.crm.exportContacts}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
