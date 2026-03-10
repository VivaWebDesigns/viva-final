import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zodResolver";
import { insertInquirySchema, type InsertInquiry } from "@shared/schema";
import { useCreateInquiry } from "@domina/hooks/use-inquiries";
import { useLanguage } from "@domina/i18n/LanguageContext";
import { Button } from "@domina/components/ui/button";
import { Input } from "@domina/components/ui/input";
import { Textarea } from "@domina/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@domina/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@domina/components/ui/select";
import { Loader2, Send } from "lucide-react";

export function ContactForm() {
  const { t, language } = useLanguage();
  const mutation = useCreateInquiry();
  const P = window.__PREVIEW__?.payload ?? null;
  // Use language-aware services so the dropdown matches the active language
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
    mutation.mutate(data, {
      onSuccess: () => {
        form.reset();
      },
    });
  };

  return (
    <div className="rounded-md border border-border bg-card p-8 shadow-sm">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{t.contactForm.title}</h3>
        <p className="text-muted-foreground text-sm mt-1">{t.contactForm.subtitle}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="form-contact">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/70 text-sm">{t.contactForm.fullName}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-name" placeholder={t.contactForm.namePlaceholder} {...field} className="bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
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
                  <FormLabel className="text-foreground/70 text-sm">{t.contactForm.email}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-email" placeholder={t.contactForm.emailPlaceholder} {...field} className="bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
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
                  <FormLabel className="text-foreground/70 text-sm">{t.contactForm.phone}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-phone" placeholder={t.contactForm.phonePlaceholder} {...field} className="bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
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
                  <FormLabel className="text-foreground/70 text-sm">{t.contactForm.zipCode}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-zip" placeholder={t.contactForm.zipPlaceholder} {...field} className="bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
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
                <FormLabel className="text-foreground/70 text-sm">{t.contactForm.serviceNeeded}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-service" className="bg-background border-border text-foreground">
                      <SelectValue placeholder={t.contactForm.selectService} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white border-border">
                    {previewServices ? (
                      previewServices.map((svc) => (
                        <SelectItem key={svc.title} value={svc.title}>{svc.title}</SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="Interior Painting">{t.contactForm.serviceOptions.interior}</SelectItem>
                        <SelectItem value="Exterior Painting">{t.contactForm.serviceOptions.exterior}</SelectItem>
                        <SelectItem value="Kitchen Cabinet Painting">{t.contactForm.serviceOptions.cabinets}</SelectItem>
                        <SelectItem value="Deck Staining & Painting">{t.contactForm.serviceOptions.deck}</SelectItem>
                        <SelectItem value="Fence Staining & Painting">{t.contactForm.serviceOptions.fence}</SelectItem>
                        <SelectItem value="Commercial Painting">{t.contactForm.serviceOptions.commercial}</SelectItem>
                        <SelectItem value="Other">{t.contactForm.serviceOptions.other}</SelectItem>
                      </>
                    )}
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
                <FormLabel className="text-foreground/70 text-sm">{t.contactForm.projectDetails}</FormLabel>
                <FormControl>
                  <Textarea
                    data-testid="textarea-message"
                    placeholder={t.contactForm.projectPlaceholder}
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
            {mutation.isPending ? t.contactForm.sending : t.contactForm.submit}
          </Button>
        </form>
      </Form>
    </div>
  );
}
