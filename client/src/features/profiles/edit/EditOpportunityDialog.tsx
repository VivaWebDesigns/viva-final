import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEditOpportunity } from "./useEntityMutations";
import type { MappedOpportunity, ProfileEntry } from "../types";

// ── Validation schema ─────────────────────────────────────────────────────────

const WEBSITE_PACKAGES = ["empieza", "crece", "domina"] as const;
const OPPORTUNITY_STATUSES = ["open", "won", "lost"] as const;

const schema = z.object({
  title:            z.string().min(1, "Title is required"),
  value:            z.string().nullable().optional(),
  websitePackage:   z.enum(WEBSITE_PACKAGES).nullable().optional(),
  status:           z.enum(OPPORTUNITY_STATUSES).default("open"),
  expectedCloseDate: z.string().nullable().optional(),
  probability:      z.coerce.number().int().min(0).max(100).nullable().optional(),
  notes:            z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new Date(value).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EditOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: MappedOpportunity;
  entry: ProfileEntry;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditOpportunityDialog({
  open, onOpenChange, opportunity, entry,
}: EditOpportunityDialogProps) {
  const { toast } = useToast();
  const mutation = useEditOpportunity(opportunity.id, entry);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title:             opportunity.title ?? "",
      value:             opportunity.value ?? "",
      websitePackage:    (opportunity.websitePackage as (typeof WEBSITE_PACKAGES)[number] | null) ?? null,
      status:            (opportunity.status as (typeof OPPORTUNITY_STATUSES)[number]) ?? "open",
      expectedCloseDate: toDateInput(opportunity.expectedCloseDate),
      probability:       null,
      notes:             "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title:             opportunity.title ?? "",
        value:             opportunity.value ?? "",
        websitePackage:    (opportunity.websitePackage as (typeof WEBSITE_PACKAGES)[number] | null) ?? null,
        status:            (opportunity.status as (typeof OPPORTUNITY_STATUSES)[number]) ?? "open",
        expectedCloseDate: toDateInput(opportunity.expectedCloseDate),
        probability:       null,
        notes:             "",
      });
    }
  }, [open, opportunity]);

  function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      value:             values.value             || null,
      websitePackage:    values.websitePackage    ?? null,
      expectedCloseDate: values.expectedCloseDate || null,
      probability:       values.probability       ?? null,
      notes:             values.notes             || null,
    };
    mutation.mutate(payload, {
      onSuccess: () => {
        toast({ title: "Opportunity updated" });
        onOpenChange(false);
      },
      onError: (err) => {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto" data-testid="dialog-edit-opportunity">
        <DialogHeader>
          <DialogTitle>Edit Opportunity</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="Charlotte Painting Website" data-testid="input-opp-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="value" render={({ field }) => (
                <FormItem>
                  <FormLabel>Value ($)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="3500"
                      data-testid="input-opp-value"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="probability" render={({ field }) => (
                <FormItem>
                  <FormLabel>Probability (%)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type="number"
                      min="0"
                      max="100"
                      placeholder="50"
                      data-testid="input-opp-probability"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-opp-status">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="websitePackage" render={({ field }) => (
                <FormItem>
                  <FormLabel>Package</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v || null)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-opp-package">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      <SelectItem value="empieza">Empieza</SelectItem>
                      <SelectItem value="crece">Crece</SelectItem>
                      <SelectItem value="domina">Domina</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="expectedCloseDate" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Expected Close Date</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type="date"
                      data-testid="input-opp-close-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Internal notes…"
                      rows={3}
                      data-testid="textarea-opp-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit-opp"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-save-edit-opp"
              >
                {mutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
