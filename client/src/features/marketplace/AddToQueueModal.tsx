import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MarketplaceQueueItem } from "@shared/schema";
import { ShoppingBag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddToQueueModal({ open, onClose }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<AddToQueueFormState>(EMPTY_FORM);

  const mutation = useMutation({
    mutationFn: (payload: AddToQueueFormState) =>
      apiRequest("POST", "/api/marketplace/queue", {
        sellerName: payload.sellerName.trim(),
        sellerProfileUrl: payload.sellerProfileUrl.trim(),
        adUrl: payload.adUrl.trim() || undefined,
        trade: payload.trade || undefined,
        city: payload.city.trim() || undefined,
        state: payload.state || undefined,
      }).then((r) => r.json()),
    onSuccess: (data: { item?: MarketplaceQueueItem; autoSkipped?: boolean; alreadyInCrm?: boolean; existingLeadName?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/queue/counts"] });
      if (data.alreadyInCrm) {
        toast({
          title: "Seller already exists in CRM",
          description: data.existingLeadName ? `Linked to: ${data.existingLeadName}` : undefined,
        });
      } else if (data.autoSkipped) {
        toast({
          title: "Seller auto-skipped",
          description: `Score ${data.item?.hispanicNameScore ?? 0} — below threshold`,
        });
      } else {
        toast({ title: "Seller added to queue", description: data.item?.sellerName });
      }
      setForm(EMPTY_FORM);
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: err.message ?? "Failed to add seller", variant: "destructive" });
    },
  });

  function handleClose() {
    if (mutation.isPending) return;
    setForm(EMPTY_FORM);
    onClose();
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
              type="url"
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
              type="url"
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
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={mutation.isPending}
              data-testid="button-cancel-add-seller"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !form.sellerName.trim() || !form.sellerProfileUrl.trim()}
              data-testid="button-submit-add-seller"
            >
              {mutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding…</>
                : "Add Seller"
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
