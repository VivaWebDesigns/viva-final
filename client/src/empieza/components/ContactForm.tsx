import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertInquirySchema, type InsertInquiry } from "@shared/schema";
import { useCreateInquiry } from "@empieza/hooks/use-inquiries";
import { Button } from "@empieza/components/ui/button";
import { Input } from "@empieza/components/ui/input";
import { Textarea } from "@empieza/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@empieza/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@empieza/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { useLanguage } from "@empieza/hooks/use-language";

export function ContactForm() {
  const mutation = useCreateInquiry();
  const { t, language } = useLanguage();

  const form = useForm<InsertInquiry>({
    resolver: zodResolver(insertInquirySchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      zipCode: "",
      service: "Interior Painting",
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
        <h3 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{t("requestEstimate")}</h3>
        <p className="text-muted-foreground text-sm mt-1">{t("formSub")}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="form-contact">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground/70 text-sm">{t("fullName")}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-name" placeholder={t("placeholderName")} {...field} className="bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
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
                  <FormLabel className="text-foreground/70 text-sm">{t("emailAddress")}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-email" placeholder={t("placeholderEmail")} {...field} className="bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
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
                  <FormLabel className="text-foreground/70 text-sm">{t("phoneNumber")}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-phone" placeholder={t("placeholderPhone")} {...field} className="bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
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
                  <FormLabel className="text-foreground/70 text-sm">{t("zipCode")}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-zip" placeholder={t("placeholderZip")} {...field} className="bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
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
                <FormLabel className="text-foreground/70 text-sm">{t("serviceNeeded")}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-service" className="bg-background border-border text-foreground">
                      <SelectValue placeholder={t("placeholderService")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white border-border">
                    <SelectItem value="Interior Painting">{language === "es" ? "Pintura de interiores" : "Interior Painting"}</SelectItem>
                    <SelectItem value="Exterior Painting">{language === "es" ? "Pintura de exteriores" : "Exterior Painting"}</SelectItem>
                    <SelectItem value="Kitchen Cabinet Painting">{language === "es" ? "Gabinetes de cocina" : "Kitchen Cabinet Painting"}</SelectItem>
                    <SelectItem value="Deck Staining">{language === "es" ? "Teñido de terrazas" : "Deck Staining"}</SelectItem>
                    <SelectItem value="Fence Staining">{language === "es" ? "Teñido de cercas" : "Fence Staining"}</SelectItem>
                    <SelectItem value="Other">{language === "es" ? "Otro" : "Other"}</SelectItem>
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
                <FormLabel className="text-foreground/70 text-sm">{t("projectDetails")}</FormLabel>
                <FormControl>
                  <Textarea
                    data-testid="textarea-message"
                    placeholder={t("placeholderMessage")}
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
            {mutation.isPending ? t("sending") : t("getQuoteBtn")}
          </Button>
        </form>
      </Form>
    </div>
  );
}
