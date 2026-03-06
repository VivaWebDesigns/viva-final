import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Star, Zap, Rocket, Crown, Check, X, ChevronDown, Shield } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { motion } from "framer-motion";
import { useState } from "react";
import SEO from "@/components/SEO";
import { t, tArr, tObjArr } from "@/content";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

type CellValue = string | boolean;

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-6 text-left gap-4"
        data-testid={`button-faq-${q.slice(1, 20).replace(/\s/g, "-").toLowerCase()}`}
      >
        <span className="text-lg font-bold text-[#111] dark:text-white">{q}</span>
        <ChevronDown className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="pb-6 pr-8">
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

function CellDisplay({ value, highlight }: { value: CellValue; highlight?: boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <div className="w-full flex justify-end pr-2">
        <Check className="w-6 h-6 text-[#10B981]" />
      </div>
    ) : (
      <div className="w-full flex justify-end pr-2">
        <X className="w-6 h-6 text-gray-300 dark:text-gray-600" />
      </div>
    );
  }
  return (
    <div className="w-full flex justify-end pr-2">
      <span className={`text-sm font-semibold ${highlight ? "text-[#0D9488]" : "text-[#111] dark:text-white"}`}>{value}</span>
    </div>
  );
}

export default function Paquetes() {
  const comparisonRows = tObjArr<{ label: string; empieza: CellValue; crece: CellValue; domina: CellValue }>("paquetes.comparison.rows");
  const faqs = tObjArr<{ q: string; a: string }>("paquetes.faq.items");
  const supportItems = tArr("paquetes.support.items");
  const whatsappUrl = t("global.whatsappUrl");

  const empiezaFeatures = tArr("paquetes.cards.empieza.features");
  const creceFeatures = tArr("paquetes.cards.crece.features");
  const dominaFeatures = tArr("paquetes.cards.domina.features");

  const packages = [
    {
      name: t("paquetes.cards.empieza.name"),
      subLabel: t("paquetes.cards.empieza.subLabel"),
      slug: "empieza",
      icon: Zap,
      positioning: t("paquetes.cards.empieza.positioning"),
      price: t("paquetes.cards.empieza.price"),
      microcopy: t("paquetes.cards.empieza.microcopy"),
      inicio: true,
      features: empiezaFeatures,
    },
    {
      name: t("paquetes.cards.crece.name"),
      subLabel: t("paquetes.cards.crece.subLabel"),
      slug: "crece",
      icon: Rocket,
      positioning: t("paquetes.cards.crece.positioning"),
      price: t("paquetes.cards.crece.price"),
      microcopy: t("paquetes.cards.crece.microcopy"),
      popular: true,
      features: creceFeatures,
    },
    {
      name: t("paquetes.cards.domina.name"),
      subLabel: t("paquetes.cards.domina.subLabel"),
      slug: "domina",
      icon: Crown,
      positioning: t("paquetes.cards.domina.positioning"),
      price: t("paquetes.cards.domina.price"),
      microcopy: t("paquetes.cards.domina.microcopy"),
      premium: true,
      bestValue: true,
      features: dominaFeatures,
    },
  ];

  return (
    <div className="overflow-x-hidden">
      <SEO
        title={t("paquetes.seo.title")}
        description={t("paquetes.seo.description")}
        path="/paquetes"
      />
      {/* HERO */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-[#111] overflow-hidden" data-testid="section-paquetes-hero">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#0D9488] rounded-full blur-[180px] -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#0D9488] rounded-full blur-[160px] translate-y-1/3 -translate-x-1/4" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" data-testid="text-paquetes-title">
              {t("paquetes.hero.title1")}{" "}
              <span className="text-[#0D9488]">
                {t("paquetes.hero.titleAccent")}
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
              {t("paquetes.hero.subtitle")}
            </motion.p>
          </motion.div>
        </div>
      </section>
      {/* COMPARISON TABLE */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-comparison">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center mb-12">
            <motion.p variants={fadeUp} className="text-[#0D9488] font-bold text-sm uppercase tracking-widest mb-4">
              {t("paquetes.comparison.sectionLabel")}
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-comparison-title">
              {t("paquetes.comparison.title")}
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeUp}>
            {/* Desktop table */}
            <div className="hidden md:block overflow-hidden rounded-md border border-gray-200 dark:border-gray-700" data-testid="table-comparison-desktop">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f5f5f5] dark:bg-[#111]">
                    <th className="text-left py-5 px-6 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[35%]"></th>
                    <th className="text-center py-5 px-4 w-[21.67%]">
                      <div className="flex flex-col items-center gap-1">
                        <Zap className="w-6 h-6 text-[#10B981]" />
                        <span className="text-lg font-extrabold text-[#111] dark:text-white">{t("paquetes.cards.empieza.name")}</span>
                      </div>
                    </th>
                    <th className="text-center pt-8 pb-5 px-4 w-[21.67%] relative">
                      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 bg-[#0D9488] text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 whitespace-nowrap shadow-sm" data-testid="badge-popular-table">
                        <Star className="w-2.5 h-2.5 fill-white" />
                        {t("paquetes.comparison.badgePopular")}
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Rocket className="w-6 h-6 text-[#10B981]" />
                        <span className="text-lg font-extrabold text-[#0D9488]">{t("paquetes.cards.crece.name")}</span>
                      </div>
                    </th>
                    <th className="text-center py-5 px-4 w-[21.67%]">
                      <div className="flex flex-col items-center gap-1">
                        <Crown className="w-6 h-6 text-[#10B981]" />
                        <span className="text-lg font-extrabold text-[#111] dark:text-white">{t("paquetes.cards.domina.name")}</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr key={row.label} className={`${i % 2 === 0 ? "bg-white dark:bg-[#0d0d0d]" : "bg-[#f5f5f5]/50 dark:bg-[#111]/50"} border-t border-gray-100 dark:border-gray-800`} data-testid={`row-comparison-${i}`}>
                      <td className="py-4 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">{row.label}</td>
                      <td className="py-4 px-4 text-center"><CellDisplay value={row.empieza} /></td>
                      <td className="py-4 px-4 text-center bg-[#0D9488]/5"><CellDisplay value={row.crece} highlight /></td>
                      <td className="py-4 px-4 text-center"><CellDisplay value={row.domina} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile comparison cards */}
            <div className="md:hidden space-y-8" data-testid="table-comparison-mobile">
              {[
                { name: t("paquetes.cards.empieza.name"), icon: Zap, color: "border-gray-200", key: "empieza" as const },
                { name: t("paquetes.cards.crece.name"), icon: Rocket, color: "border-[#0D9488]", key: "crece" as const, popular: true },
                { name: t("paquetes.cards.domina.name"), icon: Crown, color: "border-gray-200", key: "domina" as const },
              ].map((plan) => (
                <div key={plan.name} className={`rounded-md border-2 ${plan.color} overflow-hidden bg-white dark:bg-[#111] relative`}>
                  {"popular" in plan && plan.popular && (
                    <div className="absolute top-0 right-0 bg-[#0D9488] text-white text-[10px] font-bold px-3 py-1 rounded-bl-md uppercase tracking-wider flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      {t("paquetes.comparison.badgePopular")}
                    </div>
                  )}
                  <div className="p-5 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
                    <plan.icon className="w-6 h-6 text-[#10B981]" />
                    <h3 className="text-xl font-extrabold text-[#111] dark:text-white">{plan.name}</h3>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {comparisonRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between px-5 py-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{row.label}</span>
                        <CellDisplay value={row[plan.key]} highlight={"popular" in plan && plan.popular} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
      {/* PACKAGE CARDS */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-paquetes-cards" id="paquetes-list">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center mb-16">
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-cards-title">
              {t("paquetes.cards.sectionTitle")}
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10 items-end">
            {packages.map((pkg) => (
              <motion.div
                key={pkg.slug}
                variants={fadeUp}
                className={`relative flex flex-col ${"popular" in pkg && pkg.popular ? "lg:scale-[1.06] lg:z-10" : ""}`}
                data-testid={`card-paquete-${pkg.slug}`}
              >
                {"inicio" in pkg && pkg.inicio && (
                  <div className="flex justify-center -mb-4 relative z-30">
                    <span className="bg-[#FCD34D] text-[#111] text-xs font-bold px-5 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-lg" data-testid="badge-inicio">
                      <Zap className="w-3 h-3 fill-[#111]" />
                      Inicio
                    </span>
                  </div>
                )}
                {"bestValue" in pkg && pkg.bestValue && (
                  <div className="flex justify-center -mb-4 relative z-30">
                    <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-5 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-lg" data-testid="badge-best-value">
                      <Crown className="w-3 h-3 fill-white" />
                      El Mejor Valor
                    </span>
                  </div>
                )}

                <div className={`rounded-[20px] border bg-white dark:bg-[#0d0d0d] flex flex-col flex-1 transition-all duration-300 relative z-20 ${"popular" in pkg && pkg.popular ? "border-[#efefef] shadow-xl shadow-[#0D9488]/5 hover:shadow-2xl hover:shadow-[#0D9488]/10" : "border-[#efefef] shadow-sm hover:shadow-lg"}`}>
                  {"popular" in pkg && pkg.popular && (
                    <>
                      <div className="absolute inset-0 rounded-[20px] bg-[#0D9488]/20 blur-[60px] -z-30 pointer-events-none scale-90" />
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex justify-center">
                        <span className="bg-[#0D9488] text-white text-xs font-bold px-5 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-lg" data-testid="badge-popular-card">
                          <Star className="w-3 h-3 fill-white" />
                          {t("paquetes.cards.badgePopular")}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="p-8 lg:p-10 text-center bg-[#ffffff] rounded-t-[20px]">
                    <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-5 bg-[#10B981]/10">
                      <pkg.icon className="w-6 h-6 text-[#10B981]" />
                    </div>
                    <h3 className="text-2xl font-extrabold text-[#111] dark:text-white mb-1">{pkg.name}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs leading-snug max-w-[220px] mx-auto mb-8">{pkg.subLabel}</p>

                    <div className="border-t border-gray-100 dark:border-gray-800 pt-6 mb-6">
                      <p className="text-3xl font-extrabold text-[#111] dark:text-white" data-testid={`text-price-${pkg.slug}`}>{pkg.price}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium mt-1">Configuración inicial del sitio</p>
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-2xl font-extrabold text-[#111] dark:text-white">$97 <span className="text-base font-semibold text-gray-400">/ mes</span></p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Hosting • soporte • mantenimiento • seguridad</p>
                        <a href="#plan-soporte" className="text-[10px] text-[#0D9488] hover:underline mt-1 inline-block">Ver qué incluye</a>
                      </div>
                    </div>
                  </div>

                  <div className="px-8 lg:px-10 pb-8 lg:pb-10 flex-1 flex flex-col bg-[#ffffff] rounded-b-[20px]">
                    <p className="text-[#0D9488] text-xs font-semibold uppercase tracking-wider mb-4">{pkg.positioning}</p>

                    <ul className="space-y-3.5 mb-10 flex-1">
                      {pkg.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700 dark:text-gray-300 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Link href={`/paquetes/${pkg.slug}`}>
                      <Button size="lg" className={`w-full rounded-full font-bold text-lg gap-2 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 ${"popular" in pkg && pkg.popular ? "bg-[#0D9488] text-white shadow-[#0D9488]/20 hover:bg-[#0F766E]" : "bg-[#111] dark:bg-white text-white dark:text-[#111] shadow-xl"}`} data-testid={`button-ver-${pkg.slug}`}>
                        {t("paquetes.cards.viewDetails")}
                        <ArrowRight className="w-5 h-5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 }} className="text-center text-sm text-gray-400 dark:text-gray-500 mt-8" data-testid="text-payment-reassurance">
            {t("paquetes.cards.paymentNote")}{" "}
            <a href={`${whatsappUrl}?text=Hola%2C%20quiero%20saber%20sobre%20opciones%20de%20pago`} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#0D9488] transition-colors">
              {t("paquetes.cards.paymentNoteLink")}
            </a>
          </motion.p>
        </div>
      </section>
      {/* SUPPORT PLAN */}
      <section id="plan-soporte" className="py-16 lg:py-20 dark:bg-[#0d0d0d] border-y border-[#efefef] bg-[#f5f5f5]" data-testid="section-support-plan">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-[#f5f5f5] dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded-full px-5 py-2 mb-6 shadow-sm">
              <Shield className="w-4 h-4 text-[#10B981]" />
              <span className="text-xs font-bold text-[#111] dark:text-white uppercase tracking-widest">{t("paquetes.support.badgeLabel")}</span>
            </motion.div>
            <motion.p variants={fadeUp} className="text-gray-500 dark:text-gray-400 text-sm max-w-xl mx-auto mb-6">
              {t("paquetes.support.description")}
            </motion.p>
            <motion.p variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold text-[#111] dark:text-white mb-2" data-testid="text-support-price">
              {t("paquetes.support.price")} <span className="text-base font-semibold text-gray-400">{t("paquetes.support.priceUnit")}</span>
            </motion.p>
            <motion.p variants={fadeUp} className="text-gray-400 dark:text-gray-500 text-xs italic mb-8">
              {t("paquetes.support.tagline")}
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-gray-600 dark:text-gray-300">
              {supportItems.map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0" />
                  {item}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* FAQ */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-paquetes-faq">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center mb-12">
            <motion.p variants={fadeUp} className="text-[#0D9488] font-bold text-sm uppercase tracking-widest mb-4">
              {t("paquetes.faq.sectionLabel")}
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-faq-title">
              {t("paquetes.faq.title")}
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}>
            {faqs.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </motion.div>
        </div>
      </section>
      {/* FINAL CTA */}
      <section className="py-24 lg:py-40 bg-[#111]" data-testid="section-paquetes-cta">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6" data-testid="text-cta-paquetes">
              {t("paquetes.cta.title")}
            </motion.h2>
            <motion.p variants={fadeUp} className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
              {t("paquetes.cta.subtitle")}
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={`${whatsappUrl}?text=Hi%2C%20I%27d%20like%20to%20know%20which%20package%20is%20best%20for%20my%20business`} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-[#25D366] text-white font-bold text-lg gap-2 rounded-full hover:shadow-lg transition-all duration-200" data-testid="button-paquetes-whatsapp">
                  <SiWhatsapp className="w-5 h-5" />
                  {t("paquetes.cta.whatsapp")}
                </Button>
              </a>
              <Link href="/contacto">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10 rounded-full hover:shadow-lg transition-all duration-200" data-testid="button-paquetes-contacto">
                  {t("paquetes.cta.contact")}
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
