import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@features/auth/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEditLead } from "./useEntityMutations";
import type { MappedLead, ProfileEntry } from "../types";

// ── Validation schema ─────────────────────────────────────────────────────────

const schema = z.object({
  title:    z.string().min(1, "Title is required"),
  value:    z.string().nullable().optional(),
  source:   z.string().nullable().optional(),
  city:     z.string().nullable().optional(),
  state:    z
    .string()
    .regex(/^[A-Z]{0,2}$/, "Use 2-letter state code (e.g. NC)")
    .nullable()
    .optional(),
  timezone: z.string().nullable().optional(),
  notes:    z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EditLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: MappedLead;
  entry: ProfileEntry;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditLeadDialog({
  open, onOpenChange, lead, entry,
}: EditLeadDialogProps) {
  const { toast } = useToast();
  const { role } = useAuth();
  const mutation = useEditLead(lead.id, entry);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title:    lead.title    ?? "",
      value:    lead.value    ?? "",
      source:   lead.source   ?? "",
      city:     lead.city     ?? "",
      state:    lead.state    ?? "",
      timezone: lead.timezone ?? "",
      notes:    "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title:    lead.title    ?? "",
        value:    lead.value    ?? "",
        source:   lead.source   ?? "",
        city:     lead.city     ?? "",
        state:    lead.state    ?? "",
        timezone: lead.timezone ?? "",
        notes:    "",
      });
    }
  }, [open, lead]);

  function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      value:    values.value    || null,
      source:   values.source   || null,
      city:     values.city     || null,
      state:    values.state    || null,
      timezone: values.timezone || null,
      notes:    values.notes    || null,
    };
    mutation.mutate(payload, {
      onSuccess: () => {
        toast({ title: "Lead updated" });
        onOpenChange(false);
      },
      onError: (err) => {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto" data-testid="dialog-edit-lead">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Lead Title *</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="Charlotte Painting Website" data-testid="input-lead-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="value" render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal Value ($)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="3500"
                      data-testid="input-lead-value"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="source" render={({ field }) => (
                <FormItem>
                  <FormLabel>Source</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="website" data-testid="input-lead-source" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="Charlotte" data-testid="input-lead-city" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="state" render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="NC"
                      maxLength={2}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      data-testid="input-lead-state"
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
                      data-testid="textarea-lead-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {lead.sellerProfileUrl && role !== "sales_rep" && (
              <div className="pt-1">
                <p className="text-xs font-medium text-gray-500 mb-1">Seller Profile URL</p>
                <a
                  href={lead.sellerProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline break-all"
                  data-testid="link-edit-seller-profile-url"
                >
                  {lead.sellerProfileUrl}
                </a>
              </div>
            )}

            {lead.adUrl && role !== "sales_rep" && (
              <div className="pt-1">
                <p className="text-xs font-medium text-gray-500 mb-1">Ad URL</p>
                <a
                  href={lead.adUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline break-all"
                  data-testid="link-edit-ad-url"
                >
                  {lead.adUrl}
                </a>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit-lead"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-save-edit-lead"
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
