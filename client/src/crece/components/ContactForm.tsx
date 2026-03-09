import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertInquirySchema, type InsertInquiry } from "@shared/schema";
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
  const P = (window as any).__PREVIEW__?.payload ?? null;
  const previewServices = P?.services as Array<{ title: string }> | null;

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
        toast({
          title: language === "en" ? "Estimate Requested" : "Estimación Solicitada",
          description: language === "en" ? "Thank you! David will contact you shortly to schedule your free estimate." : "¡Gracias! David se pondrá en contacto con usted en breve para programar su estimación gratuita.",
        });
        form.reset();
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: language === "en" ? "Error" : "Error",
          description: language === "en" ? "Something went wrong. Please try calling us instead." : "Algo salió mal. Por favor, intente llamarnos en su lugar.",
        });
      },
    });
  };

  const services = previewServices
    ? previewServices.map((svc) => ({ value: svc.title, label: svc.title }))
    : [
        { value: "Interior Painting", label: t("services.interior") },
        { value: "Exterior Painting", label: t("services.exterior") },
        { value: "Kitchen Cabinet Painting", label: t("services.cabinets") },
        { value: "Deck Staining & Painting", label: t("services.deck") },
        { value: "Fence Staining & Painting", label: t("services.fence") },
        { value: "Commercial Painting", label: t("services.commercial") },
        { value: "Other", label: language === "en" ? "Other" : "Otro" },
      ];

  return (
    <div className="rounded-md border border-border bg-card p-8 shadow-sm">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
          {language === "en" ? "Get Your Free Estimate" : "Obtenga su Estimación Gratis"}
        </h3>
        <p className="text-muted-foreground text-sm mt-1">
          {language === "en" ? "Fill out the form below and David will get back to you within 24 hours." : "Complete el formulario a continuación y David le responderá en un plazo de 24 horas."}
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
                  <FormLabel className="text-foreground/70 text-sm">{language === "en" ? "Full Name" : "Nombre Completo"}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-name" placeholder="John Smith" {...field} className="bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
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
                  <FormLabel className="text-foreground/70 text-sm">{language === "en" ? "Email Address" : "Correo Electrónico"}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-email" placeholder="john@example.com" {...field} className="bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
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
                  <FormLabel className="text-foreground/70 text-sm">{language === "en" ? "Phone Number" : "Número de Teléfono"}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-phone" placeholder="(704) 555-0123" {...field} className="bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
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
                  <FormLabel className="text-foreground/70 text-sm">{language === "en" ? "Zip Code" : "Código Postal"}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-zip" placeholder="28202" {...field} className="bg-background border-border text-foreground placeholder:text-muted-foreground/50" />
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
                <FormLabel className="text-foreground/70 text-sm">{language === "en" ? "Service Needed" : "Servicio Necesario"}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-service" className="bg-background border-border text-foreground">
                      <SelectValue placeholder={language === "en" ? "Select a service" : "Seleccione un servicio"} />
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
                <FormLabel className="text-foreground/70 text-sm">{language === "en" ? "Project Details" : "Detalles del Proyecto"}</FormLabel>
                <FormControl>
                  <Textarea
                    data-testid="textarea-message"
                    placeholder={language === "en" ? "Tell us about your project..." : "Cuéntenos sobre su proyecto..."}
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
            {mutation.isPending ? (language === "en" ? "Sending..." : "Enviando...") : (language === "en" ? "Get My Free Quote" : "Obtener Mi Presupuesto Gratis")}
          </Button>
        </form>
      </Form>
    </div>
  );
}
