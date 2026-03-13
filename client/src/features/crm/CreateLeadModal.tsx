import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminLang } from "@/i18n/LanguageContext";
import { Loader2, UserPlus } from "lucide-react";
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

const schema = z.object({
  firstName:     z.string().min(1),
  lastName:      z.string().min(1),
  businessName:  z.string().optional(),
  businessTrade: z.string().min(1),
  phone:         z.string().min(1),
  email:         z.string().email().optional().or(z.literal("")),
  website:       z.string().optional(),
  source:        z.enum(["website", "outreach"]),
  notes:         z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateLeadModal({ open, onClose }: Props) {
  const { t } = useAdminLang();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      businessName: "",
      businessTrade: "",
      phone: "",
      email: "",
      website: "",
      source: "website",
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      apiRequest("POST", "/api/crm/leads/manual", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities"] });
      toast({ title: t.crm.leadCreated });
      form.reset();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: err.message ?? t.common.error, variant: "destructive" });
    },
  });

  function handleClose() {
    if (mutation.isPending) return;
    form.reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-500" />
            {t.crm.createNewLead}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="space-y-4 pt-1"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.crm.firstName} <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input data-testid="input-first-name" placeholder={t.crm.firstName} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.crm.lastName} <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input data-testid="input-last-name" placeholder={t.crm.lastName} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.crm.businessName}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-business-name" placeholder={t.crm.businessName} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="businessTrade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.crm.businessTrade} <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input data-testid="input-business-trade" placeholder={t.crm.businessTrade} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.common.phone} <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input data-testid="input-phone" type="tel" placeholder={t.common.phone} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.common.email}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-email" type="email" placeholder={t.common.email} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.common.website}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-website" placeholder="https://" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.crm.source} <span className="text-red-500">*</span></FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-source">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="website">{t.crm.sourceWebsite}</SelectItem>
                      <SelectItem value="outreach">{t.crm.sourceOutreach}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.common.notes}</FormLabel>
                  <FormControl>
                    <Textarea
                      data-testid="textarea-notes"
                      placeholder={t.common.notes}
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={mutation.isPending}
                data-testid="button-cancel-lead"
              >
                {t.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-save-lead"
              >
                {mutation.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t.common.saving}</>
                  : t.crm.saveLead
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
