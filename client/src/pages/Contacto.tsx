import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Mail, MapPin, Clock, ArrowRight, CheckCircle2, Send, MessageCircle } from "lucide-react";
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
import { t, tArr } from "@/content";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function Contacto() {
  const { toast } = useToast();
  const tradeOptions = tArr("contacto.trades");
  const serviceOptions = tArr("contacto.services");
  const whyItems = tArr("contacto.sidebar.whyItems");
  const whatsappUrl = t("global.whatsappUrl");

  const form = useForm<InsertContact>({
    resolver: zodResolver(insertContactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      business: "",
      city: "",
      trade: "",
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
        title: t("contacto.form.successTitle"),
        description: t("contacto.form.successDesc"),
      });
      form.reset();
    },
    onError: () => {
      toast({
        title: t("contacto.form.errorTitle"),
        description: t("contacto.form.errorDesc"),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertContact) => {
    mutation.mutate(data);
  };

  return (
    <div className="overflow-x-hidden">
      <SEO
        title={t("contacto.seo.title")}
        description={t("contacto.seo.description")}
        path="/contacto"
      />

      {/* HERO */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-gradient-to-br from-[#111] via-[#111] to-[#111] overflow-hidden" data-testid="section-contacto-hero">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#0D9488] rounded-full blur-[180px] -translate-y-1/3 -translate-x-1/4" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#0D9488] rounded-full blur-[160px] translate-y-1/3 translate-x-1/4" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" data-testid="text-contacto-title">
              {t("contacto.hero.title1")}{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0D9488] to-[#14B8A6]">
                {t("contacto.hero.titleAccent")}
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
              {t("contacto.hero.subtitle")}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* FORM SECTION */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-contacto-form">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
            {/* FORM */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger}
              className="lg:col-span-3"
            >
              <motion.div variants={fadeUp}>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700 dark:text-gray-300 font-semibold">{t("contacto.form.nameLabel")}</FormLabel>
                            <FormControl>
                              <Input placeholder={t("contacto.form.namePlaceholder")} className="h-12 bg-[#f5f5f5] dark:bg-[#111] border-gray-200 dark:border-gray-700" data-testid="input-name" {...field} />
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
                            <FormLabel className="text-gray-700 dark:text-gray-300 font-semibold">{t("contacto.form.phoneLabel")}</FormLabel>
                            <FormControl>
                              <Input placeholder={t("contacto.form.phonePlaceholder")} className="h-12 bg-[#f5f5f5] dark:bg-[#111] border-gray-200 dark:border-gray-700" data-testid="input-phone" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700 dark:text-gray-300 font-semibold">{t("contacto.form.cityLabel")}</FormLabel>
                            <FormControl>
                              <Input placeholder={t("contacto.form.cityPlaceholder")} className="h-12 bg-[#f5f5f5] dark:bg-[#111] border-gray-200 dark:border-gray-700" data-testid="input-city" {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="trade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700 dark:text-gray-300 font-semibold">{t("contacto.form.tradeLabel")}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                              <FormControl>
                                <SelectTrigger className="h-12 bg-[#f5f5f5] dark:bg-[#111] border-gray-200 dark:border-gray-700" data-testid="select-trade">
                                  <SelectValue placeholder={t("contacto.form.tradePlaceholder")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {tradeOptions.map((option) => (
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
                    </div>

                    <FormField
                      control={form.control}
                      name="service"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 dark:text-gray-300 font-semibold">{t("contacto.form.serviceLabel")}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ""}>
                            <FormControl>
                              <SelectTrigger className="h-12 bg-[#f5f5f5] dark:bg-[#111] border-gray-200 dark:border-gray-700" data-testid="select-service">
                                <SelectValue placeholder={t("contacto.form.servicePlaceholder")} />
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
                          <FormLabel className="text-gray-700 dark:text-gray-300 font-semibold">{t("contacto.form.messageLabel")}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t("contacto.form.messagePlaceholder")}
                              className="min-h-[120px] bg-[#f5f5f5] dark:bg-[#111] border-gray-200 dark:border-gray-700 resize-none"
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
                      className="w-full bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-lg gap-2 rounded-full transition-all duration-200 hover:shadow-lg"
                      disabled={mutation.isPending}
                      data-testid="button-submit-contact"
                    >
                      {mutation.isPending ? (
                        t("contacto.form.sending")
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          {t("contacto.form.submit")}
                        </>
                      )}
                    </Button>

                    <div className="flex items-center justify-center gap-2 pt-2">
                      <MessageCircle className="w-4 h-4 text-[#10B981]" />
                      <p className="text-sm font-semibold text-gray-600 dark:text-gray-400" data-testid="text-reassurance">
                        {t("contacto.form.reassurance")}
                      </p>
                    </div>
                  </form>
                </Form>
              </motion.div>
            </motion.div>

            {/* SIDEBAR */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger}
              className="lg:col-span-2"
            >
              <motion.div variants={fadeUp} className="space-y-8">
                {/* WhatsApp CTA */}
                <div className="bg-[#25D366]/10 border-2 border-[#25D366]/30 rounded-md p-8 text-center" data-testid="card-whatsapp-cta">
                  <SiWhatsapp className="w-12 h-12 text-[#25D366] mx-auto mb-4" />
                  <h3 className="text-xl font-extrabold text-[#111] dark:text-white mb-2">{t("contacto.sidebar.whatsappTitle")}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                    {t("contacto.sidebar.whatsappDesc")}
                  </p>
                  <a href={`${whatsappUrl}?text=Hi%2C%20I%27d%20like%20information%20about%20your%20services`} target="_blank" rel="noopener noreferrer">
                    <Button size="lg" className="w-full bg-[#25D366] text-white font-bold text-lg gap-2 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-contacto-whatsapp">
                      <SiWhatsapp className="w-5 h-5" />
                      {t("contacto.sidebar.whatsappBtn")}
                    </Button>
                  </a>
                </div>

                {/* Contact info */}
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-[#111] dark:text-white">{t("contacto.sidebar.contactInfoTitle")}</h3>
                  <a href="tel:+1234567890" className="flex items-start gap-4 group" data-testid="link-contacto-phone">
                    <div className="w-12 h-12 rounded-md bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-6 h-6 text-[#10B981]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#111] dark:text-white">{t("contacto.sidebar.phoneLabel")}</p>
                      <p className="text-gray-600 dark:text-gray-400">{t("global.phone")}</p>
                    </div>
                  </a>

                  <a href={`mailto:${t("global.email")}`} className="flex items-start gap-4 group" data-testid="link-contacto-email">
                    <div className="w-12 h-12 rounded-md bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6 text-[#10B981]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#111] dark:text-white">{t("contacto.sidebar.emailLabel")}</p>
                      <p className="text-gray-600 dark:text-gray-400">{t("global.email")}</p>
                    </div>
                  </a>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-md bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-[#10B981]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#111] dark:text-white">{t("contacto.sidebar.locationLabel")}</p>
                      <p className="text-gray-600 dark:text-gray-400">{t("contacto.sidebar.locationValue")}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-md bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#111] dark:text-white">{t("contacto.sidebar.hoursLabel")}</p>
                      <p className="text-gray-600 dark:text-gray-400">{t("contacto.sidebar.hoursWeekday")}</p>
                      <p className="text-gray-600 dark:text-gray-400">{t("contacto.sidebar.hoursSaturday")}</p>
                    </div>
                  </div>
                </div>

                {/* Reassurance */}
                <div className="bg-[#f5f5f5] dark:bg-[#111] rounded-md p-8">
                  <h3 className="text-lg font-bold text-[#111] dark:text-white mb-4">{t("contacto.sidebar.whyTitle")}</h3>
                  <ul className="space-y-3">
                    {whyItems.map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-[#10B981] flex-shrink-0" />
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
