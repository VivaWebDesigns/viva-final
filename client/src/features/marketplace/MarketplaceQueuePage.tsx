import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/features/auth/useAuth";
import type { MarketplaceQueueItem } from "@shared/schema";
import { Link } from "wouter";
import {
  ShoppingBag, Plus, ExternalLink, Copy, CheckCheck, UserPlus,
  SkipForward, Eye, Loader2, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { US_STATES } from "@/lib/usStates";
import CreateLeadModal from "@/features/crm/CreateLeadModal";
import AddToQueueModal from "./AddToQueueModal";
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

interface QueueCardProps {
  item: MarketplaceQueueItem;
  onStatusChange: (id: string, status: "reviewed" | "skipped" | "converted", createdLeadId?: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}

function QueueCard({ item, onStatusChange, onDelete, canDelete }: QueueCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [createLeadOpen, setCreateLeadOpen] = useState(false);

  const isConverted = item.status === "converted";

  const copyMessage = async () => {
    await navigator.clipboard.writeText("What's a good contact number?");
    setCopied(true);
    toast({ title: "Message copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const tradeLabel = item.trade
    ? item.trade.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  const location = [item.city, item.state].filter(Boolean).join(", ");

  const initialValues = {
    firstName: item.firstName ?? undefined,
    lastName: item.lastName ?? undefined,
    businessTrade: item.trade ?? undefined,
    city: item.city ?? undefined,
    state: (item.state && US_STATES.includes(item.state as typeof US_STATES[number]))
      ? item.state as typeof US_STATES[number]
      : undefined,
    sellerProfileUrl: item.sellerProfileUrl,
    adUrl: item.adUrl ?? undefined,
  };

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
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${scoreBadgeClass(item.hispanicNameScore)}`}
            data-testid={`badge-score-${item.id}`}
          >
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

        {isConverted && item.createdLeadId && (
          <Link href={`/admin/crm/leads/${item.createdLeadId}`}>
            <span className="text-xs text-emerald-700 font-medium underline cursor-pointer" data-testid={`link-converted-lead-${item.id}`}>
              View Lead →
            </span>
          </Link>
        )}

        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={isConverted || item.status === "skipped"}
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
            disabled={isConverted || item.status === "reviewed"}
            onClick={() => onStatusChange(item.id, "reviewed")}
            data-testid={`button-mark-reviewed-${item.id}`}
          >
            <Eye className="w-3 h-3 mr-1" />
            Reviewed
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            disabled={isConverted}
            onClick={() => setCreateLeadOpen(true)}
            data-testid={`button-create-lead-${item.id}`}
          >
            <UserPlus className="w-3 h-3 mr-1" />
            Create Lead
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-gray-500"
            disabled={isConverted}
            onClick={copyMessage}
            data-testid={`button-copy-message-${item.id}`}
          >
            {copied
              ? <><CheckCheck className="w-3 h-3 mr-1 text-green-600" />Copied</>
              : <><Copy className="w-3 h-3 mr-1" />Copy Message</>
            }
          </Button>
          {canDelete && (
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
        initialValues={initialValues}
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
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const canDelete = role === "admin" || role === "developer";

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
    mutationFn: ({ id, status, createdLeadId }: { id: string; status: "reviewed" | "skipped" | "converted"; createdLeadId?: string }) =>
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

  function handleStatusChange(id: string, status: "reviewed" | "skipped" | "converted", createdLeadId?: string) {
    patchMutation.mutate({ id, status, createdLeadId });
  }

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
              canDelete={canDelete}
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
