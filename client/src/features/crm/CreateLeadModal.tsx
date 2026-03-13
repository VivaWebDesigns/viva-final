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

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
] as const;

const STATE_TIMEZONE: Record<string, string> = {
  AL: "America/Chicago",   AK: "America/Anchorage",  AZ: "America/Phoenix",
  AR: "America/Chicago",   CA: "America/Los_Angeles", CO: "America/Denver",
  CT: "America/New_York",  DE: "America/New_York",    FL: "America/New_York",
  GA: "America/New_York",  HI: "Pacific/Honolulu",    ID: "America/Boise",
  IL: "America/Chicago",   IN: "America/Indiana/Indianapolis", IA: "America/Chicago",
  KS: "America/Chicago",   KY: "America/New_York",    LA: "America/Chicago",
  ME: "America/New_York",  MD: "America/New_York",    MA: "America/New_York",
  MI: "America/Detroit",   MN: "America/Chicago",     MS: "America/Chicago",
  MO: "America/Chicago",   MT: "America/Denver",      NE: "America/Chicago",
  NV: "America/Los_Angeles", NH: "America/New_York",  NJ: "America/New_York",
  NM: "America/Denver",    NY: "America/New_York",    NC: "America/New_York",
  ND: "America/Chicago",   OH: "America/New_York",    OK: "America/Chicago",
  OR: "America/Los_Angeles", PA: "America/New_York",  RI: "America/New_York",
  SC: "America/New_York",  SD: "America/Chicago",     TN: "America/Chicago",
  TX: "America/Chicago",   UT: "America/Denver",      VT: "America/New_York",
  VA: "America/New_York",  WA: "America/Los_Angeles", WV: "America/New_York",
  WI: "America/Chicago",   WY: "America/Denver",
};

const schema = z.object({
  firstName:     z.string().min(1),
  lastName:      z.string().min(1),
  businessName:  z.string().optional(),
  businessTrade: z.string().min(1),
  phone:         z.string().min(1),
  email:         z.string().email().optional().or(z.literal("")),
  website:       z.string().optional(),
  source:        z.enum(["website", "outreach"]),
  city:          z.string().min(1, "City is required"),
  state:         z.string().min(1, "State is required"),
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
      city: "",
      state: "",
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const timezone = STATE_TIMEZONE[values.state] ?? null;
      return apiRequest("POST", "/api/crm/leads/manual", { ...values, timezone });
    },
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
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input data-testid="input-city" placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State <span className="text-red-500">*</span></FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-state">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {US_STATES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
