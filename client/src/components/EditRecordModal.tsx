import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAdminLang } from "@/i18n/LanguageContext";
import { WEBSITE_PACKAGES } from "@shared/schema";

const PKG_NONE = "none";

export interface EditContactData {
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface EditCompanyData {
  name?: string | null;
  industry?: string | null;
  city?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  contactId: string;
  contact: EditContactData;
  companyId?: string | null;
  company?: EditCompanyData | null;
  opportunityId?: string | null;
  websitePackage?: string | null;
}

interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
  businessName: string;
  industry: string;
  city: string;
  websitePackage: string;
}

export default function EditRecordModal({
  open,
  onClose,
  onSaved,
  contactId,
  contact,
  companyId,
  company,
  opportunityId,
  websitePackage,
}: Props) {
  const { t } = useAdminLang();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
    businessName: "",
    industry: "",
    city: "",
    websitePackage: PKG_NONE,
  });

  useEffect(() => {
    if (open) {
      setForm({
        firstName: contact.firstName ?? "",
        lastName: contact.lastName ?? "",
        phone: contact.phone ?? "",
        email: contact.email ?? "",
        notes: contact.notes ?? "",
        businessName: company?.name ?? "",
        industry: company?.industry ?? "",
        city: company?.city ?? "",
        websitePackage: websitePackage ?? PKG_NONE,
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const field =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.firstName.trim()) {
      toast({
        title: t.crm.firstName + " is required",
        variant: "destructive",
      });
      return;
    }

    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      toast({ title: "Invalid email format", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);

      await apiRequest("PUT", `/api/crm/contacts/${contactId}`, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
      });

      if (companyId) {
        await apiRequest("PUT", `/api/crm/companies/${companyId}`, {
          name: form.businessName.trim() || undefined,
          industry: form.industry.trim() || null,
          city: form.city.trim() || null,
        });
      }

      if (opportunityId) {
        const pkgToSave =
          form.websitePackage === PKG_NONE ? null : form.websitePackage;
        const originalPkg = websitePackage ?? null;
        if (pkgToSave !== originalPkg) {
          await apiRequest(
            "PUT",
            `/api/pipeline/opportunities/${opportunityId}`,
            { websitePackage: pkgToSave }
          );
        }
      }

      queryClient.invalidateQueries({
        queryKey: ["/api/crm/contacts", contactId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      if (companyId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/crm/companies", companyId],
        });
      }
      if (opportunityId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/pipeline/opportunities", opportunityId],
        });
      }

      toast({ title: t.common.changesSaved });
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast({
        title: "Error saving changes",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.crm.editDetails}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-firstName">{t.crm.firstName}</Label>
            <Input
              id="edit-firstName"
              value={form.firstName}
              onChange={field("firstName")}
              data-testid="input-edit-firstName"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-lastName">{t.crm.lastName}</Label>
            <Input
              id="edit-lastName"
              value={form.lastName}
              onChange={field("lastName")}
              data-testid="input-edit-lastName"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-phone">{t.common.phone}</Label>
            <Input
              id="edit-phone"
              value={form.phone}
              onChange={field("phone")}
              data-testid="input-edit-phone"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-email">{t.common.email}</Label>
            <Input
              id="edit-email"
              type="email"
              value={form.email}
              onChange={field("email")}
              data-testid="input-edit-email"
            />
          </div>

          {companyId && (
            <>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="edit-businessName">{t.crm.businessName}</Label>
                <Input
                  id="edit-businessName"
                  value={form.businessName}
                  onChange={field("businessName")}
                  data-testid="input-edit-businessName"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-industry">{t.crm.businessTrade}</Label>
                <Input
                  id="edit-industry"
                  value={form.industry}
                  onChange={field("industry")}
                  data-testid="input-edit-industry"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-city">{t.common.city}</Label>
                <Input
                  id="edit-city"
                  value={form.city}
                  onChange={field("city")}
                  data-testid="input-edit-city"
                />
              </div>
            </>
          )}

          {opportunityId && (
            <div className="col-span-2 space-y-1.5">
              <Label>{t.pipeline.package}</Label>
              <Select
                value={form.websitePackage}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, websitePackage: v }))
                }
              >
                <SelectTrigger data-testid="select-edit-package">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PKG_NONE}>—</SelectItem>
                  {WEBSITE_PACKAGES.map((pkg) => (
                    <SelectItem key={pkg} value={pkg}>
                      {pkg.charAt(0).toUpperCase() + pkg.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="edit-notes">{t.common.notes}</Label>
            <Textarea
              id="edit-notes"
              value={form.notes}
              onChange={field("notes")}
              rows={3}
              data-testid="textarea-edit-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            data-testid="button-edit-cancel"
          >
            {t.common.cancel}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            data-testid="button-edit-save"
          >
            {saving ? t.common.saving : t.common.saveChanges}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
