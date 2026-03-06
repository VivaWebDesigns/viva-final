import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Star, ArrowRight, CheckCircle2, XCircle, Image, Eye, PhoneCall, ChevronDown, Zap, Rocket, Crown, Shield } from "lucide-react";
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

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-6 text-left gap-4"
        data-testid={`button-faq-${q.slice(1, 15).replace(/\s/g, "-").toLowerCase()}`}
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

export default function Home() {
  const testimonials = tObjArr<{ name: string; business: string; text: string; trade: string }>("home.testimonials.items");
  const faqs = tObjArr<{ q: string; a: string }>("home.faq.items");
  const processSteps = tObjArr<{ step: string; title: string; desc: string }>("home.process.steps");
  const solutionCards = tObjArr<{ title: string; desc: string }>("home.solution.cards");
  const solutionIcons = [Image, Eye, PhoneCall];
  const trustItems = [t("home.hero.trust1"), t("home.hero.trust2"), t("home.hero.trust3")];
  const problemItems = tArr("home.problem.items");
  const beforeItems = tArr("home.beforeAfter.beforeItems");
  const afterItems = tArr("home.beforeAfter.afterItems");
  const supportItems = tArr("home.support.items");
  const whatsappUrl = t("global.whatsappUrl");

  const packages = [
    {
      name: t("home.packages.empieza.name"),
      subLabel: t("home.packages.empieza.subLabel"),
      slug: "empieza",
      icon: Zap,
      desc: t("home.packages.empieza.desc"),
      positioning: t("home.packages.empieza.positioning"),
      price: t("home.packages.empieza.price"),
      microcopy: t("home.packages.empieza.microcopy"),
    },
    {
      name: t("home.packages.crece.name"),
      subLabel: t("home.packages.crece.subLabel"),
      slug: "crece",
      icon: Rocket,
      desc: t("home.packages.crece.desc"),
      positioning: t("home.packages.crece.positioning"),
      price: t("home.packages.crece.price"),
      microcopy: t("home.packages.crece.microcopy"),
      popular: true,
    },
    {
      name: t("home.packages.domina.name"),
      subLabel: t("home.packages.domina.subLabel"),
      slug: "domina",
      icon: Crown,
      desc: t("home.packages.domina.desc"),
      positioning: t("home.packages.domina.positioning"),
      price: t("home.packages.domina.price"),
      microcopy: t("home.packages.domina.microcopy"),
      premium: true,
      bestValue: true,
    },
  ];

  return (
    <div className="overflow-x-hidden">
      <SEO
        title={t("home.seo.title")}
        description={t("home.seo.description")}
        path="/"
      />
      {/* SECTION 1 – HERO */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden" data-testid="section-hero">
        <div className="absolute inset-0 bg-[#111]">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80')] bg-cover bg-center opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#111] via-[#111]/83 to-[#111]/63" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-40">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-3xl">
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white leading-[1.1] tracking-tight mb-6" data-testid="text-hero-title">
              {t("home.hero.title1")}{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0D9488] to-[#14B8A6]">
                {t("home.hero.titleAccent")}
              </span>{" "}
              {t("home.hero.title2")}
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-300 leading-relaxed mb-10 max-w-2xl" data-testid="text-hero-subtitle">
              {t("home.hero.subtitle")}
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start gap-4">
              <Link href="/paquetes">
                <Button size="lg" className="rounded-full bg-[#0D9488] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-hero-paquetes">
                  {t("home.hero.ctaPackages")}
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href={`${whatsappUrl}?text=Hi%2C%20I%27m%20interested%20in%20learning%20more%20about%20your%20services`} target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="rounded-full text-white border-white/30 font-bold text-lg gap-2 bg-white/5 backdrop-blur-sm hover:shadow-lg transition-all duration-200" data-testid="button-hero-whatsapp">
                  <SiWhatsapp className="w-5 h-5" />
                  {t("home.hero.ctaWhatsapp")}
                </Button>
              </a>
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-x-5 gap-y-2 mt-6">
              {trustItems.map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-sm text-white/60">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  {item}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>
      {/* SECTION 2 – PROBLEM */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-problem">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="max-w-3xl mx-auto">
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight mb-10 text-center" data-testid="text-problem-title">
              {t("home.problem.title1")}{" "}
              <span className="text-[#0D9488]">{t("home.problem.titleAccent")}</span>
            </motion.h2>

            <motion.div variants={fadeUp} className="space-y-5 mb-10">
              {problemItems.map((item) => (
                <div key={item} className="flex items-start gap-4 p-4 rounded-md bg-red-50 dark:bg-red-950/20">
                  <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-800 dark:text-gray-200 font-medium text-lg">{item}</span>
                </div>
              ))}
            </motion.div>

            <motion.p variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold text-center text-red-500">
              {t("home.problem.conclusion")}
            </motion.p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link href="/paquetes">
              <Button size="lg" className="rounded-full bg-[#0D9488] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-paquetes-problem">
                {t("home.ctaButtons.verPaquetes")}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href={`${whatsappUrl}?text=Hi%2C%20I%27m%20interested%20in%20learning%20more%20about%20your%20services`} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="rounded-full text-[#111] dark:text-white border-gray-300 dark:border-gray-600 font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-whatsapp-problem">
                <SiWhatsapp className="w-5 h-5" />
                {t("home.ctaButtons.whatsapp")}
              </Button>
            </a>
          </motion.div>
        </div>
      </section>
      {/* SECTION 3 – SOLUTION POSITIONING */}
      <section className="py-24 lg:py-40 bg-[#f5f5f5] dark:bg-[#111]" data-testid="section-solution">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight mb-6" data-testid="text-solution-title">
              {t("home.solution.title1")}{" "}
              <span className="text-[#0D9488]">{t("home.solution.titleAccent")}</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
              {t("home.solution.subtitle")}
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {solutionCards.map((item, i) => {
              const Icon = solutionIcons[i];
              return (
                <motion.div key={item.title} variants={fadeUp} className="p-8 lg:p-10 rounded-md bg-teal-50 dark:bg-teal-950/30 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-white dark:bg-gray-800 flex items-center justify-center mb-6">
                    <Icon className="w-8 h-8 text-[#10B981]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#111] dark:text-white mb-3">{item.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link href="/paquetes">
              <Button size="lg" className="rounded-full bg-[#0D9488] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-paquetes-solution">
                {t("home.ctaButtons.verPaquetes")}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href={`${whatsappUrl}?text=Hi%2C%20I%27m%20interested%20in%20learning%20more%20about%20your%20services`} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="rounded-full text-[#111] dark:text-white border-gray-300 dark:border-gray-600 font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-whatsapp-solution">
                <SiWhatsapp className="w-5 h-5" />
                {t("home.ctaButtons.whatsapp")}
              </Button>
            </a>
          </motion.div>
        </div>
      </section>
      {/* SECTION 4 – PACKAGES PREVIEW */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-packages">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
            <motion.p variants={fadeUp} className="text-[#0D9488] font-bold text-sm uppercase tracking-widest mb-4">
              {t("home.packages.sectionLabel")}
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-packages-title">
              {t("home.packages.title")}
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10 items-end" id="paquetes">
            {packages.map((pkg) => (
              <motion.div
                key={pkg.slug}
                variants={fadeUp}
                className={`relative flex flex-col ${"popular" in pkg && pkg.popular ? "md:scale-[1.06] md:z-10" : ""}`}
                data-testid={`card-package-${pkg.slug}`}
              >
                {"popular" in pkg && pkg.popular && (
                  <div className="flex justify-center mb-3 relative z-20">
                    <span className="bg-[#0D9488] text-white text-xs font-bold px-5 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-lg" data-testid="badge-popular">
                      <Star className="w-3 h-3 fill-white" />
                      {t("home.packages.badgePopular")}
                    </span>
                  </div>
                )}
                {"bestValue" in pkg && pkg.bestValue && (
                  <div className="flex justify-center mb-3 relative z-20">
                    <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-5 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-lg" data-testid="badge-best-value">
                      <Crown className="w-3 h-3 fill-white" />
                      El Mejor Valor
                    </span>
                  </div>
                )}
                <div className={`rounded-[20px] border bg-white dark:bg-[#0d0d0d] flex flex-col flex-1 transition-all duration-300 relative z-20 ${"popular" in pkg && pkg.popular ? "md:scale-[1.06] border-white shadow-xl shadow-[#0D9488]/5 hover:shadow-2xl hover:shadow-[#0D9488]/10" : "border-white shadow-sm hover:shadow-lg"}`}>
                  {"popular" in pkg && pkg.popular && (
                    <div className="absolute inset-0 rounded-[20px] bg-[#0D9488]/20 blur-[60px] -z-30 pointer-events-none scale-110" />
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
                    <p className="text-[#0D9488] text-xs font-semibold uppercase tracking-wider mb-3">{pkg.positioning}</p>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-8 flex-1 text-sm">{pkg.desc}</p>
                    <Link href={`/paquetes/${pkg.slug}`}>
                      <Button size="lg" className={`w-full rounded-full font-bold text-lg gap-2 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 ${"popular" in pkg && pkg.popular ? "bg-[#0D9488] text-white shadow-[#0D9488]/20 hover:bg-[#0F766E]" : "premium" in pkg && pkg.premium ? "bg-[#111] dark:bg-white text-white dark:text-[#111] shadow-xl" : "bg-white dark:bg-[#0d0d0d] text-[#111] dark:text-white border border-[#111]/10 dark:border-white/10 hover:border-[#111]/20"}`} data-testid={`button-ver-${pkg.slug}`}>
                        {t("home.packages.viewDetails")}
                        <ArrowRight className="w-5 h-5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 }} className="text-center text-sm text-gray-400 dark:text-gray-500 mt-8" data-testid="text-payment-reassurance">
            {t("home.packages.paymentNote")}{" "}
            <a href={`${whatsappUrl}?text=Hola%2C%20quiero%20saber%20sobre%20opciones%20de%20pago`} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#0D9488] transition-colors">
              {t("home.packages.paymentNoteLink")}
            </a>
          </motion.p>
        </div>
      </section>
      {/* SUPPORT PLAN */}
      <section id="plan-soporte" className="py-16 lg:py-20 bg-[#f5f5f5] dark:bg-[#111]" data-testid="section-support-plan">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white dark:bg-[#0d0d0d] border border-gray-200 dark:border-gray-700 rounded-full px-5 py-2 mb-6 shadow-sm">
              <Shield className="w-4 h-4 text-[#10B981]" />
              <span className="text-xs font-bold text-[#111] dark:text-white uppercase tracking-widest">{t("home.support.badgeLabel")}</span>
            </motion.div>
            <motion.p variants={fadeUp} className="text-gray-500 dark:text-gray-400 text-sm max-w-xl mx-auto mb-6">
              {t("home.support.description")}
            </motion.p>
            <motion.p variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold text-[#111] dark:text-white mb-2" data-testid="text-support-price">
              {t("home.support.price")} <span className="text-base font-semibold text-gray-400">{t("home.support.priceUnit")}</span>
            </motion.p>
            <motion.p variants={fadeUp} className="text-gray-400 dark:text-gray-500 text-xs italic mb-8">
              {t("home.support.tagline")}
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
      {/* SECTION 5 – BEFORE / AFTER */}
      <section className="py-24 lg:py-40 bg-[#111] relative overflow-hidden" data-testid="section-before-after">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[2px] bg-gradient-to-r from-transparent via-[#0D9488] to-transparent shadow-[0_0_120px_60px_rgba(13,148,136,0.4)] pointer-events-none opacity-80" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[2px] bg-gradient-to-r from-transparent via-[#0D9488] to-transparent shadow-[0_0_120px_60px_rgba(13,148,136,0.4)] pointer-events-none opacity-80" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center mb-16">
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight" data-testid="text-before-after-title">
              {t("home.beforeAfter.title1")} <span className="text-[#0D9488]">{t("home.beforeAfter.titleAccent")}</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            <motion.div variants={fadeUp} className="rounded-md border border-red-500/30 bg-red-950/20 p-8 lg:p-10" data-testid="card-before">
              <div className="text-red-400 font-bold text-sm uppercase tracking-widest mb-6">{t("home.beforeAfter.beforeLabel")}</div>
              <ul className="space-y-5">
                {beforeItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-lg font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div variants={fadeUp} className="rounded-md border border-[#0D9488]/30 bg-[#0D9488]/10 p-8 lg:p-10" data-testid="card-after">
              <div className="text-[#0D9488] font-bold text-sm uppercase tracking-widest mb-6">{t("home.beforeAfter.afterLabel")}</div>
              <ul className="space-y-5">
                {afterItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#10B981] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-200 text-lg font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link href="/paquetes">
              <Button size="lg" className="rounded-full bg-[#0D9488] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-paquetes-beforeafter">
                {t("home.ctaButtons.verPaquetes")}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href={`${whatsappUrl}?text=Hi%2C%20I%27m%20interested%20in%20learning%20more%20about%20your%20services`} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="rounded-full text-white border-white/30 bg-white/5 font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-whatsapp-beforeafter">
                <SiWhatsapp className="w-5 h-5" />
                {t("home.ctaButtons.whatsapp")}
              </Button>
            </a>
          </motion.div>
        </div>
      </section>
      {/* SECTION 6 – HOW IT WORKS */}
      <section id="como-funciona" className="scroll-mt-20 py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-process">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
            <motion.p variants={fadeUp} className="text-[#0D9488] font-bold text-sm uppercase tracking-widest mb-4">
              {t("home.process.sectionLabel")}
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-process-title">
              {t("home.process.title")}
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {processSteps.map((item) => (
              <motion.div key={item.step} variants={fadeUp} className="text-center relative">
                <div className="text-7xl font-extrabold text-gray-100 dark:text-gray-800 mb-4">{item.step}</div>
                <h3 className="text-lg font-bold text-[#111] dark:text-white mb-3">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link href="/paquetes">
              <Button size="lg" className="rounded-full bg-[#0D9488] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-paquetes-process">
                {t("home.ctaButtons.verPaquetes")}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href={`${whatsappUrl}?text=Hi%2C%20I%27m%20interested%20in%20learning%20more%20about%20your%20services`} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="rounded-full text-[#111] dark:text-white border-gray-300 dark:border-gray-600 font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-whatsapp-process">
                <SiWhatsapp className="w-5 h-5" />
                {t("home.ctaButtons.whatsapp")}
              </Button>
            </a>
          </motion.div>
        </div>
      </section>
      {/* SECTION 7 – TESTIMONIALS */}
      <section className="py-24 lg:py-40 dark:bg-[#111] relative overflow-hidden bg-[#ffffff]" data-testid="section-testimonials">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-[#0D9488]/30 to-transparent shadow-[0_0_100px_40px_rgba(13,148,136,0.1)] pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-[#0D9488]/30 to-transparent shadow-[0_0_100px_40px_rgba(13,148,136,0.1)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
            <motion.p variants={fadeUp} className="text-[#0D9488] font-bold text-sm uppercase tracking-widest mb-4">
              {t("home.testimonials.sectionLabel")}
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-testimonials-title">
              {t("home.testimonials.title1")}{" "}
              <span className="text-[#0D9488]">{t("home.testimonials.titleAccent")}</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <motion.div key={testimonial.name} variants={fadeUp} className="bg-white dark:bg-gray-800 rounded-md p-8" data-testid={`card-testimonial-${testimonial.name.split(" ")[0].toLowerCase()}`}>
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6 italic">"{testimonial.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0D9488] to-[#14B8A6] flex items-center justify-center text-white font-bold">
                    {testimonial.name.split(" ").map((n: string) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-bold text-[#111] dark:text-white">{testimonial.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{testimonial.business} · {testimonial.trade}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link href="/paquetes">
              <Button size="lg" className="rounded-full bg-[#0D9488] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-paquetes-testimonials">
                {t("home.ctaButtons.verPaquetes")}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href={`${whatsappUrl}?text=Hi%2C%20I%27m%20interested%20in%20learning%20more%20about%20your%20services`} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="rounded-full text-[#111] dark:text-white border-gray-300 dark:border-gray-600 font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-whatsapp-testimonials">
                <SiWhatsapp className="w-5 h-5" />
                {t("home.ctaButtons.whatsapp")}
              </Button>
            </a>
          </motion.div>
        </div>
      </section>
      {/* SECTION 8 – FAQ */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-faq">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center mb-16">
            <motion.p variants={fadeUp} className="text-[#0D9488] font-bold text-sm uppercase tracking-widest mb-4">
              {t("home.faq.sectionLabel")}
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-faq-title">
              {t("home.faq.title")}
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}>
            {faqs.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link href="/paquetes">
              <Button size="lg" className="rounded-full bg-[#0D9488] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-paquetes-faq">
                {t("home.ctaButtons.verPaquetes")}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href={`${whatsappUrl}?text=Hi%2C%20I%27m%20interested%20in%20learning%20more%20about%20your%20services`} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="rounded-full text-[#111] dark:text-white border-gray-300 dark:border-gray-600 font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-whatsapp-faq">
                <SiWhatsapp className="w-5 h-5" />
                {t("home.ctaButtons.whatsapp")}
              </Button>
            </a>
          </motion.div>
        </div>
      </section>
      {/* SECTION 9 – FINAL CTA */}
      <section className="py-24 lg:py-40 bg-[#111]" data-testid="section-cta">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6" data-testid="text-cta-title">
              {t("home.cta.title")}
            </motion.h2>
            <motion.p variants={fadeUp} className="text-2xl text-white/90 mb-10 font-semibold">
              {t("home.cta.subtitle")}
            </motion.p>
            <motion.div variants={fadeUp}>
              <Link href="/contacto">
                <Button size="lg" className="rounded-full bg-[#0D9488] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-bottom">
                  {t("home.cta.button")}
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
