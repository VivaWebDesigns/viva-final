import { useEffect } from "react";
import { normalizePhoneDigits, formatPhoneDisplay } from "@shared/phone";
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
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEditContact } from "./useEntityMutations";
import { useAdminLang } from "@/i18n/LanguageContext";
import type { MappedContact, ProfileEntry } from "../types";

const schema = z.object({
  firstName:         z.string().min(1, "First name is required"),
  lastName:          z.string().nullable().optional(),
  email:             z.string().email("Invalid email").nullable().optional().or(z.literal("")),
  phone:             z.string().nullable().optional(),
  altPhone:          z.string().nullable().optional(),
  title:             z.string().nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  notes:             z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

export interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: MappedContact;
  entry: ProfileEntry;
}

export function EditContactDialog({
  open, onOpenChange, contact, entry,
}: EditContactDialogProps) {
  const { t } = useAdminLang();
  const ps = t.profileShell;
  const { toast } = useToast();
  const mutation = useEditContact(contact.id, entry);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName:         contact.firstName ?? "",
      lastName:          contact.lastName ?? "",
      email:             contact.email ?? "",
      phone:             contact.phone ?? "",
      altPhone:          contact.altPhone ?? "",
      title:             contact.title ?? "",
      preferredLanguage: contact.preferredLanguage ?? "es",
      notes:             "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        firstName:         contact.firstName ?? "",
        lastName:          contact.lastName ?? "",
        email:             contact.email ?? "",
        phone:             contact.phone ?? "",
        altPhone:          contact.altPhone ?? "",
        title:             contact.title ?? "",
        preferredLanguage: contact.preferredLanguage ?? "es",
        notes:             "",
      });
    }
  }, [open, contact]);

  function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      lastName:  values.lastName  || null,
      email:     values.email     || null,
      phone:     values.phone ? normalizePhoneDigits(values.phone) || null : null,
      altPhone:  values.altPhone ? normalizePhoneDigits(values.altPhone) || null : null,
      title:     values.title     || null,
      preferredLanguage: values.preferredLanguage || null,
      notes:     values.notes     || null,
    };
    mutation.mutate(payload, {
      onSuccess: () => {
        toast({ title: ps.contactUpdated });
        onOpenChange(false);
      },
      onError: (err) => {
        toast({ title: ps.updateFailed, description: err.message, variant: "destructive" });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto" data-testid="dialog-edit-contact">
        <DialogHeader>
          <DialogTitle>{ps.editContact}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem>
                  <FormLabel>{ps.firstName} *</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="Jane" data-testid="input-contact-firstname" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <FormLabel>{ps.lastName}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="Doe" data-testid="input-contact-lastname" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>{ps.titleRole}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="Owner" data-testid="input-contact-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>{ps.email}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} type="email" placeholder="jane@company.com" data-testid="input-contact-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>{ps.phone}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type="tel"
                      placeholder="(704) 555-1234"
                      data-testid="input-contact-phone"
                      onBlur={() => {
                        if (field.value) {
                          const normalized = normalizePhoneDigits(field.value);
                          if (normalized.length === 10) field.onChange(formatPhoneDisplay(normalized));
                        }
                        field.onBlur();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="altPhone" render={({ field }) => (
                <FormItem>
                  <FormLabel>{ps.altPhone}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type="tel"
                      placeholder="(704) 555-5678"
                      data-testid="input-contact-alt-phone"
                      onBlur={() => {
                        if (field.value) {
                          const normalized = normalizePhoneDigits(field.value);
                          if (normalized.length === 10) field.onChange(formatPhoneDisplay(normalized));
                        }
                        field.onBlur();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="preferredLanguage" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>{ps.preferredLanguage}</FormLabel>
                  <Select
                    value={field.value ?? "es"}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-contact-language">
                        <SelectValue placeholder={ps.selectLanguage} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="es">{ps.languageSpanish}</SelectItem>
                      <SelectItem value="en">{ps.languageEnglish}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit-contact"
              >
                {ps.cancel}
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-save-edit-contact"
              >
                {mutation.isPending ? ps.saving : ps.saveChanges}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
