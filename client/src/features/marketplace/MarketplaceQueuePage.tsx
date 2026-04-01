import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminLang } from "@/i18n/LanguageContext";
import type { MarketplaceQueueItem } from "@shared/schema";
import { Link } from "wouter";
import {
  ShoppingBag, Plus, ExternalLink, Copy, CheckCheck, UserPlus,
  SkipForward, Eye, Loader2, Trash2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { US_STATES } from "@/lib/usStates";
import { BUSINESS_TRADES } from "@/features/crm/CreateLeadModal";
import CreateLeadModal from "@/features/crm/CreateLeadModal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TABS = [
  { key: "pending",   label: "Pending" },
  { key: "reviewed",  label: "Reviewed" },
  { key: "skipped",   label: "Skipped" },
  { key: "converted", label: "Converted" },
] as const;

type Tab = typeof TABS[number]["key"];

function scoreBadgeClass(score: number) {
  if (score >= 70) return "bg-green-100 text-green-800 border border-green-300";
  if (score >= 50) return "bg-yellow-100 text-yellow-800 border border-yellow-300";
  return "bg-gray-100 text-gray-600 border border-gray-200";
}

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    return u.hostname + (path.length > 30 ? path.slice(0, 30) + "…" : path);
  } catch {
    return url.slice(0, 40);
  }
}

interface AddToQueueFormState {
  sellerName: string;
  sellerProfileUrl: string;
  adUrl: string;
  trade: string;
  city: string;
  state: string;
}

const EMPTY_FORM: AddToQueueFormState = {
  sellerName: "",
  sellerProfileUrl: "",
  adUrl: "",
  trade: "",
  city: "",
  state: "",
};

interface AddQueueResponse {
  item?: MarketplaceQueueItem;
  autoSkipped?: boolean;
  alreadyInCrm?: boolean;
  existingLeadId?: string;
  existingLeadName?: string;
  reason?: string;
}

function AddToQueueModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<AddToQueueFormState>(EMPTY_FORM);
  const [result, setResult] = useState<AddQueueResponse | null>(null);

  const { t } = useAdminLang();

  const mutation = useMutation({
    mutationFn: (payload: AddToQueueFormState) =>
      apiRequest("POST", "/api/marketplace/queue", {
        sellerName: payload.sellerName,
        sellerProfileUrl: payload.sellerProfileUrl,
        adUrl: payload.adUrl || undefined,
        trade: payload.trade || undefined,
        city: payload.city || undefined,
        state: payload.state || undefined,
      }).then((r) => r.json() as Promise<AddQueueResponse>),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/queue/counts"] });
      setResult(data);
    },
    onError: (err: Error) => {
      toast({ title: err.message ?? "Failed to add seller", variant: "destructive" });
    },
  });

  function handleClose() {
    if (mutation.isPending) return;
    setForm(EMPTY_FORM);
    setResult(null);
    onClose();
  }

  function handleAddAnother() {
    setForm(EMPTY_FORM);
    setResult(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sellerName.trim() || !form.sellerProfileUrl.trim()) return;
    mutation.mutate(form);
  }

  function set(field: keyof AddToQueueFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-violet-500" />
            Add Seller to Queue
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            {result.alreadyInCrm ? (
              <div className="flex flex-col gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-800">Already in CRM</p>
                    <p className="text-sm text-blue-700 mt-1">
                      This seller is linked to an existing lead:&nbsp;
                      <Link href={`/admin/crm/leads/${result.existingLeadId}`} className="underline font-medium">
                        {result.existingLeadName ?? "View Lead"}
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            ) : result.autoSkipped ? (
              <div className="flex flex-col gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-start gap-2">
                  <SkipForward className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-700">Auto-skipped</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Score: <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${scoreBadgeClass(result.item?.hispanicNameScore ?? 0)}`}>
                        {result.item?.hispanicNameScore ?? 0}
                      </span>. {result.reason}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-start gap-2">
                  <CheckCheck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-800">Added to queue</p>
                    <p className="text-sm text-green-700 mt-1">
                      <span className="font-medium">{result.item?.sellerName}</span> — Score:&nbsp;
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${scoreBadgeClass(result.item?.hispanicNameScore ?? 0)}`}>
                        {result.item?.hispanicNameScore ?? 0}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={handleAddAnother} data-testid="button-add-another">
                Add Another
              </Button>
              <Button className="flex-1" onClick={handleClose} data-testid="button-done-adding">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="mq-seller-name">
                Seller Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="mq-seller-name"
                data-testid="input-mq-seller-name"
                placeholder="e.g. Juan Garcia"
                value={form.sellerName}
                onChange={(e) => set("sellerName", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mq-profile-url">
                Seller Profile URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="mq-profile-url"
                data-testid="input-mq-seller-profile-url"
                placeholder="https://facebook.com/marketplace/seller/..."
                value={form.sellerProfileUrl}
                onChange={(e) => set("sellerProfileUrl", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mq-ad-url">Ad URL</Label>
              <Input
                id="mq-ad-url"
                data-testid="input-mq-ad-url"
                placeholder="https://facebook.com/marketplace/item/..."
                value={form.adUrl}
                onChange={(e) => set("adUrl", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="mq-trade">Trade</Label>
                <Select value={form.trade} onValueChange={(v) => set("trade", v)}>
                  <SelectTrigger id="mq-trade" data-testid="select-mq-trade">
                    <SelectValue placeholder="Select trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TRADES.map((trade) => (
                      <SelectItem key={trade} value={trade}>
                        {trade.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mq-state">State</Label>
                <Select value={form.state} onValueChange={(v) => { set("state", v); set("city", ""); }}>
                  <SelectTrigger id="mq-state" data-testid="select-mq-state">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mq-city">City</Label>
              <Input
                id="mq-city"
                data-testid="input-mq-city"
                placeholder="e.g. Charlotte"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={mutation.isPending} data-testid="button-cancel-add-seller">
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending || !form.sellerName.trim() || !form.sellerProfileUrl.trim()} data-testid="button-submit-add-seller">
                {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding…</> : "Add Seller"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface QueueCardProps {
  item: MarketplaceQueueItem;
  onStatusChange: (id: string, status: string, createdLeadId?: string) => void;
  onDelete?: (id: string) => void;
  isAdmin: boolean;
}

function QueueCard({ item, onStatusChange, onDelete, isAdmin }: QueueCardProps) {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [createLeadOpen, setCreateLeadOpen] = useState(false);

  const copyMessage = async (id: string) => {
    await navigator.clipboard.writeText("What's a good contact number?");
    setCopiedId(id);
    toast({ title: "Message copied to clipboard" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const tradeLabel = item.trade
    ? item.trade.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  const location = [item.city, item.state].filter(Boolean).join(", ");

  return (
    <>
      <div
        className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
        data-testid={`card-queue-item-${item.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-gray-900 leading-tight" data-testid={`text-seller-name-${item.id}`}>
              {item.sellerName}
            </p>
            {item.normalizedName && item.normalizedName !== item.sellerName.toLowerCase() && (
              <p className="text-xs text-gray-400 mt-0.5">{item.normalizedName}</p>
            )}
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${scoreBadgeClass(item.hispanicNameScore)}`} data-testid={`badge-score-${item.id}`}>
            {item.hispanicNameScore}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {tradeLabel && (
            <Badge variant="outline" className="text-xs">{tradeLabel}</Badge>
          )}
          {location && (
            <Badge variant="outline" className="text-xs text-gray-600">{location}</Badge>
          )}
          {item.spanishOutreachRecommended && (
            <Badge className="text-xs bg-green-100 text-green-800 border border-green-300 hover:bg-green-100">
              Spanish outreach ✓
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <a
            href={item.sellerProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline truncate"
            data-testid={`link-seller-profile-${item.id}`}
          >
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{shortUrl(item.sellerProfileUrl)}</span>
          </a>
          {item.adUrl && (
            <a
              href={item.adUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline truncate"
              data-testid={`link-ad-url-${item.id}`}
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{shortUrl(item.adUrl)}</span>
            </a>
          )}
        </div>

        {item.status === "converted" && item.createdLeadId && (
          <Link href={`/admin/crm/leads/${item.createdLeadId}`}>
            <span className="text-xs text-emerald-700 font-medium underline cursor-pointer" data-testid={`link-converted-lead-${item.id}`}>
              View Lead →
            </span>
          </Link>
        )}

        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
          {item.status === "pending" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onStatusChange(item.id, "skipped")}
                data-testid={`button-skip-${item.id}`}
              >
                <SkipForward className="w-3 h-3 mr-1" />
                Skip
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onStatusChange(item.id, "reviewed")}
                data-testid={`button-mark-reviewed-${item.id}`}
              >
                <Eye className="w-3 h-3 mr-1" />
                Reviewed
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => setCreateLeadOpen(true)}
                data-testid={`button-create-lead-${item.id}`}
              >
                <UserPlus className="w-3 h-3 mr-1" />
                Create Lead
              </Button>
            </>
          )}
          {(item.status === "pending" || item.status === "reviewed") && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-gray-500"
              onClick={() => copyMessage(item.id)}
              data-testid={`button-copy-message-${item.id}`}
            >
              {copiedId === item.id
                ? <><CheckCheck className="w-3 h-3 mr-1 text-green-600" />Copied</>
                : <><Copy className="w-3 h-3 mr-1" />Copy Message</>
              }
            </Button>
          )}
          {isAdmin && item.status !== "converted" && onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-red-500 hover:text-red-700 ml-auto"
              onClick={() => onDelete(item.id)}
              data-testid={`button-delete-queue-${item.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      <CreateLeadModal
        open={createLeadOpen}
        onClose={() => setCreateLeadOpen(false)}
        initialValues={{
          firstName: item.firstName ?? undefined,
          lastName: item.lastName ?? undefined,
          businessTrade: item.trade ?? undefined,
          city: item.city ?? undefined,
          state: item.state ?? undefined,
          sellerProfileUrl: item.sellerProfileUrl,
          adUrl: item.adUrl ?? undefined,
        }}
        onLeadCreated={(leadId) => {
          onStatusChange(item.id, "converted", leadId);
        }}
      />
    </>
  );
}

export default function MarketplaceQueuePage() {
  const { t } = useAdminLang();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<MarketplaceQueueItem[]>({
    queryKey: ["/api/marketplace/queue", activeTab],
    queryFn: () =>
      fetch(`/api/marketplace/queue?status=${activeTab}`, { credentials: "include" })
        .then((r) => r.json()),
  });

  const { data: counts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/marketplace/queue/counts"],
    refetchInterval: 30000,
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, status, createdLeadId }: { id: string; status: string; createdLeadId?: string }) =>
      apiRequest("PATCH", `/api/marketplace/queue/${id}`, { status, createdLeadId }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/queue/counts"] });
    },
    onError: (err: Error) => {
      toast({ title: err.message ?? "Failed to update", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/marketplace/queue/${id}`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/queue/counts"] });
      setDeleteId(null);
      toast({ title: "Deleted" });
    },
    onError: (err: Error) => {
      toast({ title: err.message ?? "Failed to delete", variant: "destructive" });
    },
  });

  function handleStatusChange(id: string, status: string, createdLeadId?: string) {
    patchMutation.mutate({ id, status, createdLeadId });
  }

  const isAdmin = true;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-violet-500" />
            {t.nav.marketplace}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review Facebook Marketplace seller listings and create leads
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="gap-2"
          data-testid="button-add-seller"
        >
          <Plus className="w-4 h-4" />
          Add Seller
        </Button>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => {
          const count = counts[tab.key] ?? 0;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-violet-500 text-violet-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              data-testid={`tab-${tab.key}`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === tab.key
                    ? "bg-violet-100 text-violet-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <ShoppingBag className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">No {activeTab} items</p>
          {activeTab === "pending" && (
            <p className="text-xs mt-1">Add sellers using the button above</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              onStatusChange={handleStatusChange}
              onDelete={(id) => setDeleteId(id)}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      <AddToQueueModal open={addOpen} onClose={() => setAddOpen(false)} />

      <AlertDialog open={deleteId !== null} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete queue item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the item from the queue. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-queue">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); }}
              data-testid="button-confirm-delete-queue"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
