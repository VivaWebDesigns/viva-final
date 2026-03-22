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
import { useEditCompany } from "./useEntityMutations";
import type { MappedCompany } from "../types";
import type { ProfileEntry } from "../types";

// ── Validation schema ─────────────────────────────────────────────────────────

const schema = z.object({
  name:              z.string().min(1, "Name is required"),
  dba:               z.string().nullable().optional(),
  phone:             z.string().nullable().optional(),
  email:             z.string().email("Invalid email").nullable().optional().or(z.literal("")),
  website:           z.string().nullable().optional(),
  address:           z.string().nullable().optional(),
  city:              z.string().nullable().optional(),
  state:             z.string().nullable().optional(),
  zip:               z.string().nullable().optional(),
  industry:          z.string().nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  notes:             z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EditCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: MappedCompany;
  entry: ProfileEntry;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditCompanyDialog({
  open, onOpenChange, company, entry,
}: EditCompanyDialogProps) {
  const { toast } = useToast();
  const mutation = useEditCompany(company.id, entry);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:              company.name ?? "",
      dba:               company.dba ?? "",
      phone:             company.phone ?? "",
      email:             company.email ?? "",
      website:           company.website ?? "",
      address:           company.address ?? "",
      city:              company.city ?? "",
      state:             company.state ?? "",
      zip:               company.zip ?? "",
      industry:          company.industry ?? "",
      preferredLanguage: company.preferredLanguage ?? "es",
      notes:             company.notes ?? "",
    },
  });

  // Reset form when dialog opens with fresh data
  useEffect(() => {
    if (open) {
      form.reset({
        name:              company.name ?? "",
        dba:               company.dba ?? "",
        phone:             company.phone ?? "",
        email:             company.email ?? "",
        website:           company.website ?? "",
        address:           company.address ?? "",
        city:              company.city ?? "",
        state:             company.state ?? "",
        zip:               company.zip ?? "",
        industry:          company.industry ?? "",
        preferredLanguage: company.preferredLanguage ?? "es",
        notes:             company.notes ?? "",
      });
    }
  }, [open, company]);

  function onSubmit(values: FormValues) {
    let website = values.website || null;
    if (website && !/^https?:\/\//i.test(website)) {
      website = `https://${website}`;
    }
    const payload = {
      ...values,
      email:  values.email  || null,
      phone:  values.phone  || null,
      website,
      dba:    values.dba    || null,
      address: values.address || null,
      city:   values.city   || null,
      state:  values.state  || null,
      zip:    values.zip    || null,
      industry: values.industry || null,
      preferredLanguage: values.preferredLanguage || null,
      notes:  values.notes  || null,
    };
    mutation.mutate(payload, {
      onSuccess: () => {
        toast({ title: "Company updated" });
        onOpenChange(false);
      },
      onError: (err) => {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto" data-testid="dialog-edit-company">
        <DialogHeader>
          <DialogTitle>Edit Company</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Company Name *</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="ACME Corp" data-testid="input-company-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="dba" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>DBA</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="Doing business as…" data-testid="input-company-dba" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} type="tel" placeholder="(555) 555-5555" data-testid="input-company-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} type="email" placeholder="hello@company.com" data-testid="input-company-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="website" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="https://company.com" data-testid="input-company-website" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Street Address</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="123 Main St" data-testid="input-company-address" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="Charlotte" data-testid="input-company-city" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="state" render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="NC" maxLength={2} data-testid="input-company-state" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="zip" render={({ field }) => (
                <FormItem>
                  <FormLabel>ZIP</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="28201" data-testid="input-company-zip" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="industry" render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="Painting" data-testid="input-company-industry" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="preferredLanguage" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Preferred Language</FormLabel>
                  <Select
                    value={field.value ?? "es"}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-company-language">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
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
                      data-testid="textarea-company-notes"
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
                data-testid="button-cancel-edit-company"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-save-edit-company"
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
