import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Crown, Globe, Search, BarChart3, Users, Palette, Settings, FileText, Headphones, Image, Zap, Rocket, Shield, CalendarDays } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { motion } from "framer-motion";
import SEO from "@/components/SEO";
import { t, tArr, tObjArr } from "@/content";
import { CALENDLY_URL } from "@/lib/externalLinks";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const featureIcons = [Globe, Search, BarChart3, Users, Image, Settings, Palette, FileText, Headphones];

export default function PaqueteDomina() {
  const idealItems = tArr("domina.ideal.items");
  const features = tObjArr<{ title: string; desc: string; why: string }>("domina.features.items");
  const supportItems = tArr("domina.support.items");
  const whatsappUrl = t("global.whatsappUrl");

  return (
    <div className="overflow-x-hidden">
      <SEO
        title={t("domina.seo.title")}
        description={t("domina.seo.description")}
        path="/paquetes/domina"
      />

      {/* HERO */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-[#111] overflow-hidden" data-testid="section-domina-hero">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#0D9488] rounded-full blur-[180px] -translate-y-1/2 translate-x-1/4" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-3xl">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Crown className="w-4 h-4 text-white" />
              <span className="text-sm text-white/90 font-medium">{t("domina.hero.badge")}</span>
              <span className="bg-white text-[#0D9488] text-xs font-bold px-2 py-0.5 rounded-full uppercase">{t("domina.hero.badgePremium")}</span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" data-testid="text-domina-title">
              {t("domina.hero.title1")}{" "}
              <span className="text-teal-200">{t("domina.hero.titleAccent")}</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-white/80 leading-relaxed mb-8 max-w-2xl">
              {t("domina.hero.subtitle")}
            </motion.p>
            <motion.p variants={fadeUp} className="text-4xl font-extrabold text-white mb-2">
              {t("domina.hero.price")}
            </motion.p>
            <motion.p variants={fadeUp} className="text-xs text-white/60 font-medium mt-1">Initial website setup</motion.p>
            <motion.div variants={fadeUp} className="mt-3 pt-3 border-t border-white/20 mb-8">
              <p className="text-2xl font-extrabold text-white">$97 <span className="text-base font-semibold text-white/60">/ month</span></p>
              <p className="text-[10px] text-white/50 mt-1">Hosting • support • maintenance • security</p>
              <a href="#plan-soporte" className="text-[10px] text-teal-300 hover:underline mt-1 inline-block">See what is included</a>
            </motion.div>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start gap-4">
              <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-[#0D9488] text-white font-bold text-lg gap-2 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-domina-cta">
                  <CalendarDays className="w-5 h-5" />
                  Schedule a demo
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-domina-ideal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp}>
              <p className="text-[#0D9488] font-bold text-sm uppercase tracking-widest mb-4">{t("domina.ideal.sectionLabel")}</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111] dark:text-white leading-tight mb-6" data-testid="text-domina-ideal-title">
                {t("domina.ideal.title")}
              </h2>
              <ul className="space-y-4">
                {idealItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#10B981] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp} className="bg-gradient-to-br from-[#0D9488] to-[#0F766E] rounded-md p-1">
              <div className="bg-white dark:bg-[#111] rounded-md p-8 lg:p-10 text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="text-sm font-bold text-[#0D9488] uppercase tracking-wider">{t("domina.ideal.cardBadge")}</span>
                </div>
                <Crown className="w-16 h-16 text-[#0D9488] mx-auto mb-6" />
                <h3 className="text-2xl font-extrabold text-[#111] dark:text-white mb-3">{t("domina.ideal.cardTitle")}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{t("domina.ideal.cardSubtitle")}</p>
                <p className="text-5xl font-extrabold text-[#0D9488] mb-1">$1,997</p>
                <p className="text-[11px] text-gray-400 font-medium mt-1 mb-4">Initial website setup</p>
                <div className="mt-2 pt-4 border-t border-gray-100 dark:border-gray-800 mb-4">
                  <p className="text-2xl font-extrabold text-[#111] dark:text-white">$97 <span className="text-base font-semibold text-gray-400">/ month</span></p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Hosting • support • maintenance • security</p>
                  <a href="#plan-soporte" className="text-[10px] text-[#0D9488] hover:underline mt-1 inline-block">See what is included</a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* WHAT'S INCLUDED — BENEFIT DRIVEN */}
      <section className="py-24 lg:py-40 bg-[#f5f5f5] dark:bg-[#111]" data-testid="section-domina-features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
            <motion.p variants={fadeUp} className="text-[#0D9488] font-bold text-sm uppercase tracking-widest mb-4">{t("domina.features.sectionLabel")}</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-domina-features-title">
              {t("domina.features.title1")} <span className="text-[#0D9488]">{t("domina.features.titleAccent")}</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="space-y-8">
            {features.map((item, i) => {
              const Icon = featureIcons[i];
              return (
                <motion.div key={item.title} variants={fadeUp} className="bg-white dark:bg-gray-800 rounded-md p-8 lg:p-10">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-1">
                      <div className="w-14 h-14 rounded-md bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center">
                        <Icon className="w-7 h-7 text-[#10B981]" />
                      </div>
                    </div>
                    <div className="lg:col-span-7">
                      <h3 className="text-xl font-bold text-[#111] dark:text-white mb-2">{item.title}</h3>
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="lg:col-span-4 bg-[#10B981]/5 rounded-md p-4">
                      <p className="text-sm font-semibold text-[#10B981]">
                        <span className="font-extrabold">{t("domina.features.whyLabel")}</span>{" "}
                        {item.why}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* DOWNGRADE COMPARISON */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-domina-compare">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <p className="text-gray-500 font-bold text-sm uppercase tracking-widest mb-4">{t("domina.compare.sectionLabel")}</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-domina-compare-title">
                {t("domina.compare.title")}
              </h2>
            </motion.div>

            <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="border-2 border-[#0D9488] rounded-md p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-7 h-7 text-[#0D9488]" />
                  <h3 className="text-lg font-extrabold text-[#111] dark:text-white">{t("domina.compare.empiezaTitle")}</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6">
                  {t("domina.compare.empiezaDesc")}
                </p>
                <Link href="/paquetes/empieza">
                  <Button variant="outline" className="w-full font-bold gap-2 border-[#0D9488] text-[#0D9488] rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-domina-ver-empieza">
                    {t("domina.compare.empiezaBtn")}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>

              <div className="border-2 border-[#0D9488] rounded-md p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Rocket className="w-7 h-7 text-[#0D9488]" />
                  <div>
                    <h3 className="text-lg font-extrabold text-[#111] dark:text-white">{t("domina.compare.creceTitle")}</h3>
                    <span className="text-xs font-bold text-[#0D9488]">{t("domina.compare.crecePopular")}</span>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6">
                  {t("domina.compare.creceDesc")}
                </p>
                <Link href="/paquetes/crece">
                  <Button variant="outline" className="w-full font-bold gap-2 border-[#0D9488] text-[#0D9488] rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-domina-ver-crece">
                    {t("domina.compare.creceBtn")}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </motion.div>

            <div className="text-center mt-8">
              <a href="/#paquetes">
                <Button variant="outline" className="font-bold gap-2 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-domina-comparar">
                  {t("domina.compare.ctaComparar")}
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SUPPORT PLAN */}
      <section id="plan-soporte" className="py-16 lg:py-20 bg-[#f5f5f5] dark:bg-[#111]" data-testid="section-support-plan">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white dark:bg-[#0d0d0d] border border-gray-200 dark:border-gray-700 rounded-full px-5 py-2 mb-6 shadow-sm">
              <Shield className="w-4 h-4 text-[#10B981]" />
              <span className="text-xs font-bold text-[#111] dark:text-white uppercase tracking-widest">{t("domina.support.badgeLabel")}</span>
            </motion.div>
            <motion.p variants={fadeUp} className="text-gray-500 dark:text-gray-400 text-sm max-w-xl mx-auto mb-6">
              {t("domina.support.description")}
            </motion.p>
            <motion.p variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold text-[#111] dark:text-white mb-2" data-testid="text-support-price">
              {t("domina.support.price")} <span className="text-base font-semibold text-gray-400">{t("domina.support.priceUnit")}</span>
            </motion.p>
            <motion.p variants={fadeUp} className="text-gray-400 dark:text-gray-500 text-xs italic mb-8">
              {t("domina.support.tagline")}
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

      {/* STRONG CTA */}
      <section className="py-24 lg:py-40 bg-[#111]" data-testid="section-domina-cta-bottom">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
              {t("domina.cta.title")}
            </motion.h2>
            <motion.p variants={fadeUp} className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
              {t("domina.cta.subtitle")}
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-[#0D9488] text-white font-bold text-lg gap-2 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-domina-cta-bottom">
                  <CalendarDays className="w-5 h-5" />
                  Schedule a demo
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
