import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminLang } from "@/i18n/LanguageContext";
import { Loader2, UserPlus } from "lucide-react";
import { DuplicateLeadBlockModal, type DuplicateMatchSummary } from "./DuplicateLeadBlockModal";
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
import { US_STATES } from "@/lib/usStates";
import { normalizePhoneDigits, formatPhoneDisplay, isValidUSPhone } from "@shared/phone";
import { CityCombobox } from "@/components/CityCombobox";

type DuplicateLeadError = Error & { code?: string; match?: DuplicateMatchSummary };

const ACRONYMS = new Set(["LLC", "INC", "HVAC", "USA", "NC", "SC", "LP", "LLP", "PLLC", "DBA"]);

function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export const BUSINESS_TRADES = [
  "painting",
  "plumbing",
  "roofing",
  "electrical",
  "landscaping",
  "hvac",
  "general_contractor",
  "house_cleaning",
  "pressure_washing",
  "carpentry",
  "flooring",
  "tile_installation",
  "fence_installation",
  "deck_building",
  "shed_building",
  "concrete_asphalt",
  "tree_service",
] as const;

const baseSchema = z.object({
  firstName:         z.string().min(1),
  lastName:          z.string().min(1),
  businessName:      z.string().optional(),
  businessTrade:     z.string().min(1),
  phone:             z.string().min(1, "Phone is required").refine(
    (v) => isValidUSPhone(v),
    { message: "Enter a valid 10-digit US phone number" }
  ),
  email:             z.string().email().optional().or(z.literal("")),
  website:           z.string().optional(),
  source:            z.enum(["website", "outreach"]),
  preferredLanguage: z.enum(["es", "en"]),
  notes:             z.string().optional(),
  city:              z.string().min(1),
  state:             z.enum(US_STATES),
});

type FormValues = z.infer<typeof baseSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateLeadModal({ open, onClose }: Props) {
  const { t } = useAdminLang();
  const { toast } = useToast();

  const validatedSchema = useMemo(() => baseSchema.extend({
    city:  z.string().min(1, t.crm.cityRequired),
    state: z.enum(US_STATES, { required_error: t.crm.stateRequired }),
  }), [t]);

  const form = useForm<FormValues>({
    resolver: zodResolver(validatedSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      businessName: "",
      businessTrade: "",
      phone: "",
      email: "",
      website: "",
      source: "website",
      preferredLanguage: "es",
      notes: "",
      city: "",
      state: undefined,
    },
  });

  const selectedState = form.watch("state");

  const [assignedToId, setAssignedToId] = useState("");
  const [assignedToError, setAssignedToError] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatchSummary | null>(null);

  const { data: assignableUsers = [] } = useQuery<{ id: string; name: string; role: string }[]>({
    queryKey: ["/api/crm/leads/assignable-users"],
  });

  const salesAndAdminUsers = assignableUsers.filter(u =>
    u.role === "sales_rep" || u.role === "admin"
  );

  const mutation = useMutation({
    mutationFn: async (payload: FormValues & { assignedTo: string }) => {
      const res = await fetch("/api/crm/leads/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string; code?: string; match?: DuplicateMatchSummary };
        const err = Object.assign(
          new Error(body.message ?? "Request failed"),
          { code: body.code, match: body.match },
        ) as DuplicateLeadError;
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities"] });
      toast({ title: t.crm.leadCreated });
      form.reset();
      setAssignedToId("");
      setAssignedToError(false);
      setDuplicateMatch(null);
      onClose();
    },
    onError: (err: Error) => {
      const dupErr = err as DuplicateLeadError;
      if (dupErr.code === "DUPLICATE_LEAD") {
        setDuplicateMatch(dupErr.match ?? null);
        return;
      }
      toast({ title: err.message ?? t.common.error, variant: "destructive" });
    },
  });

  function handleSubmit(values: FormValues) {
    if (!assignedToId) {
      setAssignedToError(true);
      return;
    }
    setAssignedToError(false);
    mutation.mutate({
      ...values,
      phone: normalizePhoneDigits(values.phone),
      assignedTo: assignedToId,
    });
  }

  function handleClose() {
    if (mutation.isPending) return;
    form.reset();
    setAssignedToId("");
    setAssignedToError(false);
    onClose();
  }

  return (
    <>
    <DuplicateLeadBlockModal
      open={duplicateMatch !== null}
      match={duplicateMatch}
      onClose={() => setDuplicateMatch(null)}
    />
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
            onSubmit={form.handleSubmit(handleSubmit)}
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
                      <Input
                        data-testid="input-first-name"
                        placeholder={t.crm.firstName}
                        {...field}
                        onBlur={() => {
                          if (field.value) field.onChange(titleCase(field.value));
                          field.onBlur();
                        }}
                      />
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
                      <Input
                        data-testid="input-last-name"
                        placeholder={t.crm.lastName}
                        {...field}
                        onBlur={() => {
                          if (field.value) field.onChange(titleCase(field.value));
                          field.onBlur();
                        }}
                      />
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
                    <Input
                      data-testid="input-business-name"
                      placeholder={t.crm.businessName}
                      {...field}
                      onBlur={() => {
                        if (field.value) field.onChange(titleCase(field.value));
                        field.onBlur();
                      }}
                    />
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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-business-trade">
                        <SelectValue placeholder={t.crm.selectBusinessTrade} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BUSINESS_TRADES.map((trade) => (
                        <SelectItem key={trade} value={trade}>
                          {(t.crm.trades as Record<string, string>)[trade] ?? trade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <Input
                      data-testid="input-phone"
                      type="tel"
                      placeholder="(704) 555-1234"
                      {...field}
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
                    <FormLabel>{t.common.city} <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <CityCombobox
                        data-testid="input-city"
                        value={field.value}
                        onChange={field.onChange}
                        stateCode={selectedState ?? ""}
                        disabled={!selectedState}
                      />
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
                    <FormLabel>{t.common.state} <span className="text-red-500">*</span></FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        form.setValue("city", "", { shouldValidate: false });
                      }}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-state">
                          <SelectValue placeholder={t.crm.selectState} />
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
              name="preferredLanguage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.clients.preferredLanguage}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-preferred-language">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="es">{t.clients.langSpanish}</SelectItem>
                      <SelectItem value="en">{t.clients.langEnglish}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Assign To <span className="text-red-500">*</span>
              </label>
              <Select value={assignedToId} onValueChange={(v) => { setAssignedToId(v); setAssignedToError(false); }}>
                <SelectTrigger data-testid="select-assigned-to">
                  <SelectValue placeholder="Select a rep..." />
                </SelectTrigger>
                <SelectContent>
                  {salesAndAdminUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id} data-testid={`option-assignee-${u.id}`}>
                      {u.name}
                      <span className="ml-2 text-xs text-gray-400 capitalize">
                        {u.role === "sales_rep" ? "Sales" : "Admin"}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignedToError && (
                <p className="text-sm font-medium text-destructive">Please assign this lead to a rep</p>
              )}
            </div>

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
    </>
  );
}
