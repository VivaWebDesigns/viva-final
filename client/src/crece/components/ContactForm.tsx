import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zodResolver";
import { insertInquirySchema, type InsertInquiry } from "@shared/schema";
import { normalizePhoneDigits, formatPhoneDisplay } from "@shared/phone";
import { useCreateInquiry } from "@crece/hooks/use-inquiries";
import { Button } from "@crece/components/ui/button";
import { Input } from "@crece/components/ui/input";
import { Textarea } from "@crece/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@crece/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@crece/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { useLanguage } from "@crece/hooks/use-language";
import { useToast } from "@crece/hooks/use-toast";

export function ContactForm() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const mutation = useCreateInquiry();
  const P = window.__PREVIEW__?.payload ?? null;
  // Use language-aware services so the service list matches the active language
  const previewServices = P
    ? (language === "es" ? P.servicesES : P.servicesEN) as Array<{ title: string }> | null
    : null;

  const form = useForm<InsertInquiry>({
    resolver: zodResolver(insertInquirySchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      zipCode: "",
      service: previewServices?.[0]?.title ?? "Interior Painting",
      message: "",
    },
  });

  const onSubmit = (data: InsertInquiry) => {
    mutation.mutate({
      ...data,
      phone: data.phone ? normalizePhoneDigits(data.phone) : data.phone,
    }, {
      onSuccess: () => {
        toast({
          title: t("toast.estimateTitle"),
          description: t("toast.estimateDesc"),
        });
        form.reset();
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: t("toast.errorTitle"),
          description: t("toast.errorDesc"),
        });
      },
    });
  };

  const services = previewServices
    ? previewServices.map((svc) => ({ value: svc.title, label: svc.title }))
    : [
        { value: "Interior Painting",         label: t("services.interior") },
        { value: "Exterior Painting",         label: t("services.exterior") },
        { value: "Kitchen Cabinet Painting",  label: t("services.cabinets") },
        { value: "Deck Staining & Painting",  label: t("services.deck") },
        { value: "Fence Staining & Painting", label: t("services.fence") },
        { value: "Commercial Painting",       label: t("services.commercial") },
        { value: "Other",                     label: t("form.other") },
      ];

  return (
    <div className="rounded-md border border-border bg-card p-8 shadow-sm">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
          {t("form.heading")}
        </h3>
        <p className="text-muted-foreground text-sm mt-1">
          {t("form.sub")}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="form-contact">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/70 text-sm">{t("form.fullName")}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-name" placeholder={t("form.placeholder.name")} {...field} className="bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
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
                  <FormLabel className="text-foreground/70 text-sm">{t("form.email")}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-email" placeholder={t("form.placeholder.email")} {...field} className="bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/70 text-sm">{t("form.phone")}</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-phone"
                      placeholder="(704) 555-1234"
                      {...field}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground/50"
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
              name="zipCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/70 text-sm">{t("form.zipCode")}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-zip" placeholder={t("form.placeholder.zip")} {...field} className="bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="service"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground/70 text-sm">{t("form.service")}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-service" className="bg-background border-border text-foreground">
                      <SelectValue placeholder={t("form.placeholder.service")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white border-border">
                    {services.map((service) => (
                      <SelectItem key={service.value} value={service.value}>
                        {service.label}
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
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground/70 text-sm">{t("form.details")}</FormLabel>
                <FormControl>
                  <Textarea
                    data-testid="textarea-message"
                    placeholder={t("form.placeholder.message")}
                    className="resize-none h-28 bg-background border-border text-foreground placeholder:text-muted-foreground/50"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            data-testid="button-submit-contact"
            className="w-full bg-primary text-primary-foreground font-semibold mt-2"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {mutation.isPending ? t("form.sending") : t("form.submit")}
          </Button>
        </form>
      </Form>
    </div>
  );
}
