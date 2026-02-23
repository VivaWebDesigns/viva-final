import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Mail, MapPin, Clock, ArrowRight, CheckCircle2, Send } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { motion } from "framer-motion";
import SEO from "@/components/SEO";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContactSchema, type InsertContact } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const serviceOptions = [
  "Sitio Web Profesional",
  "SEO y Google Maps",
  "Google Ads",
  "Redes Sociales",
  "Branding y Logo",
  "Automatización y CRM",
  "Paquete Completo",
  "No Estoy Seguro",
];

export default function Contacto() {
  const { toast } = useToast();
  const seo = (
    <SEO
      title="Contacto - Cotización Gratis"
      description="Contáctanos para una cotización gratis. Hablamos español y respondemos en menos de 24 horas. Sin compromiso."
      path="/contacto"
    />
  );

  const form = useForm<InsertContact>({
    resolver: zodResolver(insertContactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      business: "",
      service: "",
      message: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertContact) => {
      const res = await apiRequest("POST", "/api/contacts", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Mensaje Enviado",
        description: "Recibimos tu mensaje. Te contactaremos dentro de 24 horas.",
      });
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Hubo un error al enviar tu mensaje. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertContact) => {
    mutation.mutate(data);
  };

  return (
    <div>
      {seo}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 overflow-hidden" data-testid="section-contacto-hero">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[hsl(340,82%,52%)] rounded-full blur-[180px] -translate-y-1/3 -translate-x-1/4" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[hsl(160,100%,37%)] rounded-full blur-[160px] translate-y-1/3 translate-x-1/4" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.p variants={fadeUp} className="text-[hsl(340,82%,60%)] font-bold text-sm uppercase tracking-widest mb-4">
              Contacto
            </motion.p>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" data-testid="text-contacto-title">
              Hablemos Sobre{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(340,82%,60%)] to-[hsl(160,100%,45%)]">
                Tu Negocio
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
              Completa el formulario o llámanos directamente. La consulta es 100% gratis y sin compromiso.
            </motion.p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-white dark:bg-gray-950" data-testid="section-contacto-form">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger}
              className="lg:col-span-3"
            >
              <motion.div variants={fadeUp}>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
                  Pide Tu Cotización Gratis
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                  Llena este formulario y te contactaremos dentro de 24 horas con un plan para tu negocio.
                </p>
              </motion.div>

              <motion.div variants={fadeUp}>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700 dark:text-gray-300 font-semibold">Nombre Completo *</FormLabel>
                            <FormControl>
                              <Input placeholder="Tu nombre" className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700" data-testid="input-name" {...field} />
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
                            <FormLabel className="text-gray-700 dark:text-gray-300 font-semibold">Teléfono *</FormLabel>
                            <FormControl>
                              <Input placeholder="(555) 123-4567" className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700" data-testid="input-phone" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700 dark:text-gray-300 font-semibold">Email *</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="tu@email.com" className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700" data-testid="input-email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="business"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700 dark:text-gray-300 font-semibold">Nombre del Negocio</FormLabel>
                            <FormControl>
                              <Input placeholder="Tu empresa" className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700" data-testid="input-business" {...field} value={field.value ?? ""} />
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
                          <FormLabel className="text-gray-700 dark:text-gray-300 font-semibold">Servicio de Interés</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ""}>
                            <FormControl>
                              <SelectTrigger className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700" data-testid="select-service">
                                <SelectValue placeholder="Selecciona un servicio" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {serviceOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
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
                          <FormLabel className="text-gray-700 dark:text-gray-300 font-semibold">Mensaje</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Cuéntanos sobre tu negocio y qué necesitas..."
                              className="min-h-[120px] bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 resize-none"
                              data-testid="textarea-message"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full bg-[hsl(340,82%,52%)] text-white font-bold text-lg gap-2"
                      disabled={mutation.isPending}
                      data-testid="button-submit-contact"
                    >
                      {mutation.isPending ? (
                        "Enviando..."
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Enviar Mensaje
                        </>
                      )}
                    </Button>

                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      Te respondemos en menos de 24 horas. Sin spam, sin compromiso.
                    </p>
                  </form>
                </Form>
              </motion.div>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger}
              className="lg:col-span-2"
            >
              <motion.div variants={fadeUp} className="space-y-8">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Información de Contacto</h3>
                  <div className="space-y-6">
                    <a href="tel:+1234567890" className="flex items-start gap-4 group" data-testid="link-contacto-phone">
                      <div className="w-12 h-12 rounded-md bg-pink-50 dark:bg-pink-950/30 flex items-center justify-center flex-shrink-0">
                        <Phone className="w-6 h-6 text-[hsl(340,82%,52%)]" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">Teléfono</p>
                        <p className="text-gray-600 dark:text-gray-400">(555) 123-4567</p>
                      </div>
                    </a>

                    <a href="https://wa.me/1234567890" className="flex items-start gap-4 group" data-testid="link-contacto-whatsapp">
                      <div className="w-12 h-12 rounded-md bg-green-50 dark:bg-green-950/30 flex items-center justify-center flex-shrink-0">
                        <SiWhatsapp className="w-6 h-6 text-green-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">WhatsApp</p>
                        <p className="text-gray-600 dark:text-gray-400">Escríbenos directamente</p>
                      </div>
                    </a>

                    <a href="mailto:info@vivawebdesigns.com" className="flex items-start gap-4 group" data-testid="link-contacto-email">
                      <div className="w-12 h-12 rounded-md bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-6 h-6 text-[hsl(160,100%,37%)]" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">Email</p>
                        <p className="text-gray-600 dark:text-gray-400">info@vivawebdesigns.com</p>
                      </div>
                    </a>

                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-md bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-6 h-6 text-amber-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">Ubicación</p>
                        <p className="text-gray-600 dark:text-gray-400">Servicio en todo EE.UU.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-md bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-6 h-6 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">Horario</p>
                        <p className="text-gray-600 dark:text-gray-400">Lunes - Viernes: 8am - 6pm</p>
                        <p className="text-gray-600 dark:text-gray-400">Sábado: 9am - 2pm</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-8">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">¿Por qué contactarnos?</h3>
                  <ul className="space-y-3">
                    {[
                      "Consulta 100% gratis",
                      "Sin compromiso ni presión",
                      "Respuesta en menos de 24 horas",
                      "Hablamos español",
                      "Plan personalizado para tu negocio",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-[hsl(160,100%,37%)] flex-shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
