import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminLang } from "@/i18n/LanguageContext";
import { User, Building2, Package } from "lucide-react";
import type { CrmContact, CrmCompany } from "@shared/schema";

const editSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.union([z.string().email("Invalid email format"), z.literal(""), z.null()]).optional(),
  altPhone: z.string().nullable().optional(),
  contactNotes: z.string().nullable().optional(),
  businessName: z.string().nullable().optional(),
  businessPhone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  websitePackage: z.enum(["empieza", "crece", "domina", ""]).nullable().optional(),
});

type EditFormValues = z.infer<typeof editSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  contact: CrmContact | null | undefined;
  company: CrmCompany | null | undefined;
  opportunityId?: string | null;
  currentPackage?: string | null;
  invalidateKeys?: string[][];
  onSaved?: () => void;
}

export default function EditRecordModal({
  open,
  onClose,
  contact,
  company,
  opportunityId,
  currentPackage,
  invalidateKeys = [],
  onSaved,
}: Props) {
  const { toast } = useToast();
  const { t } = useAdminLang();

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      altPhone: "",
      contactNotes: "",
      businessName: "",
      businessPhone: "",
      website: "",
      industry: "",
      city: "",
      websitePackage: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        firstName: contact?.firstName ?? "",
        lastName: contact?.lastName ?? "",
        phone: contact?.phone ?? "",
        email: contact?.email ?? "",
        altPhone: contact?.altPhone ?? "",
        contactNotes: contact?.notes ?? "",
        businessName: company?.name ?? "",
        businessPhone: company?.phone ?? "",
        website: company?.website ?? "",
        industry: company?.industry ?? "",
        city: company?.city ?? "",
        websitePackage: (currentPackage as "empieza" | "crece" | "domina" | "" | null) ?? "",
      });
    }
  }, [open, contact, company, currentPackage]);

  const saveMutation = useMutation({
    mutationFn: async (values: EditFormValues) => {
      const promises: Promise<unknown>[] = [];

      if (contact?.id) {
        const contactPayload: Record<string, unknown> = {
          firstName: values.firstName,
          lastName: values.lastName || null,
          phone: values.phone || null,
          email: values.email || null,
          altPhone: values.altPhone || null,
          notes: values.contactNotes || null,
        };
        promises.push(apiRequest("PUT", `/api/crm/contacts/${contact.id}`, contactPayload).then(r => r.json()));
      }

      if (company?.id) {
        const companyPayload: Record<string, unknown> = {
          name: values.businessName || company.name,
          phone: values.businessPhone || null,
          website: values.website || null,
          industry: values.industry || null,
          city: values.city || null,
        };
        promises.push(apiRequest("PUT", `/api/crm/companies/${company.id}`, companyPayload).then(r => r.json()));
      }

      if (opportunityId && values.websitePackage !== undefined) {
        const pkg = values.websitePackage || null;
        promises.push(apiRequest("PUT", `/api/pipeline/opportunities/${opportunityId}`, { websitePackage: pkg }).then(r => r.json()));
      }

      await Promise.all(promises);
    },
    onSuccess: () => {
      const keys: string[][] = [
        ...(contact?.id ? [["/api/crm/contacts", contact.id]] : []),
        ...(company?.id ? [["/api/crm/companies", company.id]] : []),
        ...(opportunityId ? [["/api/pipeline/opportunities", opportunityId]] : []),
        ...invalidateKeys,
      ];
      keys.forEach(k => queryClient.invalidateQueries({ queryKey: k }));
      toast({ title: t.crm.detailsSaved });
      onSaved?.();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const hasContact = !!contact;
  const hasCompany = !!company;
  const hasPackage = !!opportunityId;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.crm.editDetails}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(v => saveMutation.mutate(v))}
          className="space-y-5 mt-1"
        >
          {hasContact && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <User className="w-3.5 h-3.5" />
                {t.crm.contactInfoSection}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="firstName" className="text-xs">{t.crm.firstName} *</Label>
                  <Input
                    id="firstName"
                    {...form.register("firstName")}
                    data-testid="input-firstName"
                    className={form.formState.errors.firstName ? "border-red-400" : ""}
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-xs text-red-500">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lastName" className="text-xs">{t.crm.lastName}</Label>
                  <Input
                    id="lastName"
                    {...form.register("lastName")}
                    data-testid="input-lastName"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-xs">{t.common.phone}</Label>
                  <Input
                    id="phone"
                    {...form.register("phone")}
                    data-testid="input-phone"
                    type="tel"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="altPhone" className="text-xs">{t.crm.altPhone}</Label>
                  <Input
                    id="altPhone"
                    {...form.register("altPhone")}
                    data-testid="input-altPhone"
                    type="tel"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">{t.common.email}</Label>
                <Input
                  id="email"
                  {...form.register("email")}
                  data-testid="input-email"
                  type="email"
                  className={form.formState.errors.email ? "border-red-400" : ""}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="contactNotes" className="text-xs">{t.common.notes}</Label>
                <Textarea
                  id="contactNotes"
                  {...form.register("contactNotes")}
                  data-testid="textarea-contactNotes"
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            </div>
          )}

          {hasContact && hasCompany && <Separator />}

          {hasCompany && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <Building2 className="w-3.5 h-3.5" />
                {t.crm.businessInfoSection}
              </div>

              <div className="space-y-1">
                <Label htmlFor="businessName" className="text-xs">{t.crm.businessName}</Label>
                <Input
                  id="businessName"
                  {...form.register("businessName")}
                  data-testid="input-businessName"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="businessPhone" className="text-xs">{t.crm.businessPhone}</Label>
                  <Input
                    id="businessPhone"
                    {...form.register("businessPhone")}
                    data-testid="input-businessPhone"
                    type="tel"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="city" className="text-xs">{t.common.city}</Label>
                  <Input
                    id="city"
                    {...form.register("city")}
                    data-testid="input-city"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="industry" className="text-xs">{t.crm.tradeIndustry}</Label>
                  <Input
                    id="industry"
                    {...form.register("industry")}
                    data-testid="input-industry"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="website" className="text-xs">{t.common.website}</Label>
                  <Input
                    id="website"
                    {...form.register("website")}
                    data-testid="input-website"
                    type="url"
                    placeholder="https://"
                  />
                </div>
              </div>
            </div>
          )}

          {hasPackage && (
            <>
              {(hasContact || hasCompany) && <Separator />}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <Package className="w-3.5 h-3.5" />
                  {t.pipeline.package}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="websitePackage" className="text-xs">{t.pipeline.package}</Label>
                  <Select
                    value={form.watch("websitePackage") ?? ""}
                    onValueChange={v => form.setValue("websitePackage", v as "empieza" | "crece" | "domina" | "")}
                  >
                    <SelectTrigger data-testid="select-websitePackage">
                      <SelectValue placeholder="— Select package —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— {t.common.unknown} —</SelectItem>
                      <SelectItem value="empieza">Empieza</SelectItem>
                      <SelectItem value="crece">Crece</SelectItem>
                      <SelectItem value="domina">Domina</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-edit">
              {t.tasks.cancel}
            </Button>
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              data-testid="button-save-edit"
            >
              {saveMutation.isPending ? t.tasks.saving : t.common.saveChanges}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
