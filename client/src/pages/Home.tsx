import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Crown,
  Eye,
  Image as ImageIcon,
  MapPinned,
  PhoneCall,
  Rocket,
  Shield,
  Star,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { motion } from "framer-motion";
import { useState } from "react";
import SEO from "@/components/SEO";
import { t, tArr, tObjArr } from "@/content";

const heroHeatmapUrl = "/img/homepage-visibility-national-blue-20260709.webp?v=20260709-blue-national-map";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const sectionLabel = "text-[#0b4bff] font-medium text-sm mb-4";
const sectionTitle = "text-3xl sm:text-4xl lg:text-5xl font-medium text-[#061a3d] leading-[1.08]";
const sectionCopy = "text-base sm:text-lg text-[#6b7185] leading-relaxed";
const cardClass = "rounded-lg border border-[#e8e8ec] bg-white shadow-[0_16px_44px_rgba(6,26,61,0.06)]";
const primaryButton = "rounded-md bg-[#0b4bff] hover:bg-[#063bd1] text-white font-medium min-h-[44px] px-6";
const outlineButton = "rounded-md border-[#d0d2da] text-[#061a3d] bg-white/70 hover:bg-white font-medium min-h-[44px] px-6";

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-[#e8e8ec] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-5 py-6 text-left"
        data-testid={`button-faq-${q.slice(1, 15).replace(/\s/g, "-").toLowerCase()}`}
      >
        <span className="text-lg font-medium text-[#061a3d]">{q}</span>
        <ChevronDown className={`h-5 w-5 flex-shrink-0 text-[#6b7185] transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="pb-6 pr-8">
          <p className="leading-relaxed text-[#6b7185]">{a}</p>
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
  const solutionIcons = [MapPinned, Eye, PhoneCall];
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
      inicio: true,
    },
    {
      name: t("home.packages.crece.name"),
      subLabel: t("home.packages.crece.subLabel"),
      slug: "crece",
      icon: Rocket,
      desc: t("home.packages.crece.desc"),
      positioning: t("home.packages.crece.positioning"),
      price: t("home.packages.crece.price"),
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
      premium: true,
      bestValue: true,
    },
  ];

  const ctaHref = `${whatsappUrl}?text=Hi%2C%20I%27m%20interested%20in%20learning%20more%20about%20your%20services`;

  return (
    <div className="overflow-x-hidden bg-white text-[#061a3d]">
      <SEO
        title={t("home.seo.title")}
        description={t("home.seo.description")}
        path="/"
      />

      <section className="relative isolate overflow-hidden bg-[#001426] pt-[62px] text-white" data-testid="section-hero">
        <div
          className="absolute inset-0 bg-no-repeat bg-[length:100%_auto] bg-[position:center_center] max-md:bg-[length:108%_auto] max-md:bg-[position:center_62px]"
          style={{ backgroundImage: `url(${heroHeatmapUrl})` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,14,27,0.96)_0%,rgba(0,14,27,0.78)_28%,rgba(0,14,27,0.2)_62%,rgba(0,14,27,0.04)_100%)] max-md:bg-[linear-gradient(180deg,rgba(0,14,27,0.58)_0%,rgba(0,14,27,0.16)_32%,rgba(0,14,27,0.86)_70%,rgba(0,14,27,0.98)_100%)]" />
        <div className="pointer-events-none absolute right-3 top-[31px] z-10 w-[118px] rounded-md border border-white/20 bg-[#000818] px-2.5 py-2 text-white shadow-[0_0_18px_rgba(0,0,0,0.36)] md:hidden" aria-hidden="true">
          <div className="text-center text-[8px] font-semibold uppercase leading-none">Visibility Level</div>
          <div className="mt-2 h-[8px] rounded-full bg-[linear-gradient(90deg,#000818_0%,#F6FFFF_100%)]" />
          <div className="mt-1 flex justify-between text-[8px] uppercase leading-none">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        <div className="relative z-10 mx-auto flex min-h-[648px] max-w-7xl flex-col px-4 py-7 sm:px-6 md:min-h-[556px] lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="mb-0 mt-[310px] max-w-[355px] drop-shadow-[0_2px_10px_rgba(0,0,0,0.72)] md:mb-5 md:mt-[42px]" data-testid="card-hero-content">
            <motion.h1 variants={fadeUp} className="text-[clamp(38px,4.3vw,60px)] font-extrabold uppercase leading-none tracking-[0.01em] text-white" data-testid="text-hero-title">
              Get found.
              <span className="block text-[#78c943]">Get called.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-5 max-w-xs text-2xl font-medium leading-[1.28] text-white/90 md:text-[clamp(24px,2.4vw,34px)]" data-testid="text-hero-subtitle">
              A rebuilt website and Google profile that turn "[trade] near me" searches into phone calls.
            </motion.p>
          </motion.div>
        </div>
      </section>

      <section className="bg-white py-20 lg:py-24" data-testid="section-problem">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <motion.h2 variants={fadeUp} className={sectionTitle} data-testid="text-problem-title">
                {t("home.problem.title1")}{" "}
                <span className="text-[#0b4bff]">{t("home.problem.titleAccent")}</span>
              </motion.h2>
            </div>
            <motion.div variants={fadeUp} className="mx-auto grid max-w-4xl gap-3">
              {problemItems.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg bg-[#f6f7fb] p-4 text-lg font-medium text-[#061a3d]">
                  <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#0b4bff]" />
                  <span>{item}</span>
                </div>
              ))}
            </motion.div>
            <motion.p variants={fadeUp} className="mx-auto mt-10 max-w-2xl text-center text-2xl font-medium text-[#061a3d]">
              {t("home.problem.conclusion")}
            </motion.p>
          </motion.div>
        </div>
      </section>

      <section className="bg-[#f6f7fb] py-20 lg:py-24" data-testid="section-solution">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <motion.p variants={fadeUp} className={sectionLabel}>
                {t("home.solution.title1")}
              </motion.p>
              <motion.h2 variants={fadeUp} className={sectionTitle} data-testid="text-solution-title">
                <span className="text-[#0b4bff]">{t("home.solution.titleAccent")}</span>
              </motion.h2>
              <motion.p variants={fadeUp} className={`${sectionCopy} mt-5`}>
                {t("home.solution.subtitle")}
              </motion.p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {solutionCards.map((item, i) => {
                const Icon = solutionIcons[i] ?? ImageIcon;
                return (
                  <motion.article key={item.title} variants={fadeUp} className={`${cardClass} p-7`}>
                    <div className="mb-5 grid h-11 w-11 place-items-center rounded-lg bg-[rgba(11,75,255,0.07)] text-[#0b4bff]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mb-3 text-xl font-medium text-[#061a3d]">{item.title}</h3>
                    <p className="leading-relaxed text-[#6b7185]">{item.desc}</p>
                  </motion.article>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      <section id="paquetes" className="scroll-mt-24 bg-white py-20 lg:py-24" data-testid="section-packages">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <motion.p variants={fadeUp} className={sectionLabel}>
                {t("home.packages.sectionLabel")}
              </motion.p>
              <motion.h2 variants={fadeUp} className={sectionTitle} data-testid="text-packages-title">
                {t("home.packages.title")}
              </motion.h2>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {packages.map((pkg) => (
                <motion.article key={pkg.slug} variants={fadeUp} className={`${cardClass} relative flex flex-col p-7 ${"popular" in pkg && pkg.popular ? "border-[#0b4bff] shadow-[0_18px_54px_rgba(11,75,255,0.12)]" : ""}`} data-testid={`card-package-${pkg.slug}`}>
                  {"popular" in pkg && pkg.popular && (
                    <span className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#0b4bff] px-3 py-1.5 text-xs font-medium text-white" data-testid="badge-popular">
                      <Star className="h-3.5 w-3.5 fill-white" />
                      {t("home.packages.badgePopular")}
                    </span>
                  )}
                  {"bestValue" in pkg && pkg.bestValue && (
                    <span className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#061a3d] px-3 py-1.5 text-xs font-medium text-white" data-testid="badge-best-value">
                      <Trophy className="h-3.5 w-3.5" />
                      Best Value
                    </span>
                  )}
                  {"inicio" in pkg && pkg.inicio && (
                    <span className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#f6f7fb] px-3 py-1.5 text-xs font-medium text-[#061a3d]" data-testid="badge-inicio">
                      <Zap className="h-3.5 w-3.5" />
                      Starter
                    </span>
                  )}
                  <div className="mb-5 grid h-11 w-11 place-items-center rounded-lg bg-[rgba(11,75,255,0.07)] text-[#0b4bff]">
                    <pkg.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-2xl font-medium text-[#061a3d]">{pkg.name}</h3>
                  <p className="mt-2 min-h-[40px] text-sm leading-relaxed text-[#6b7185]">{pkg.subLabel}</p>
                  <div className="my-6 border-y border-[#e8e8ec] py-6">
                    <p className="text-3xl font-medium text-[#061a3d]" data-testid={`text-price-${pkg.slug}`}>{pkg.price}</p>
                    <p className="mt-1 text-xs text-[#6b7185]">Initial website setup</p>
                  </div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[#0b4bff]">{pkg.positioning}</p>
                  <p className="mb-7 flex-1 leading-relaxed text-[#6b7185]">{pkg.desc}</p>
                  <Link href={`/paquetes/${pkg.slug}`}>
                    <Button size="lg" className={`${"popular" in pkg && pkg.popular ? primaryButton : "rounded-md bg-[#061a3d] text-white hover:bg-[#0b254f] font-medium min-h-[44px] px-6"} w-full`} data-testid={`button-ver-${pkg.slug}`}>
                      {t("home.packages.viewDetails")}
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </Link>
                </motion.article>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section id="plan-soporte" className="bg-[#f6f7fb] py-16 lg:py-20" data-testid="section-support-plan">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger} className={`${cardClass} p-7 text-center sm:p-9`}>
            <motion.div variants={fadeUp} className="mx-auto mb-5 grid h-11 w-11 place-items-center rounded-lg bg-[rgba(11,75,255,0.07)] text-[#0b4bff]">
              <Shield className="h-5 w-5" />
            </motion.div>
            <motion.p variants={fadeUp} className={sectionLabel}>
              {t("home.support.badgeLabel")}
            </motion.p>
            <motion.p variants={fadeUp} className={`${sectionCopy} mx-auto max-w-2xl`}>
              {t("home.support.description")}
            </motion.p>
            <motion.p variants={fadeUp} className="mt-7 text-3xl font-medium text-[#061a3d]" data-testid="text-support-price">
              {t("home.support.price")} <span className="text-base text-[#6b7185]">{t("home.support.priceUnit")}</span>
            </motion.p>
            <motion.div variants={fadeUp} className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-[#6b7185]">
              {supportItems.map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[#0b4bff]" />
                  {item}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="bg-[#061a3d] py-20 text-white lg:py-24" data-testid="section-before-after">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <motion.h2 variants={fadeUp} className="text-3xl font-medium leading-[1.08] text-white sm:text-4xl lg:text-5xl" data-testid="text-before-after-title">
                {t("home.beforeAfter.title1")} <span className="text-white">{t("home.beforeAfter.titleAccent")}</span>
              </motion.h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <motion.article variants={fadeUp} className="rounded-lg border border-white/10 bg-white/[0.04] p-7" data-testid="card-before">
                <div className="mb-6 text-sm font-medium uppercase tracking-widest text-white/50">{t("home.beforeAfter.beforeLabel")}</div>
                <ul className="space-y-4">
                  {beforeItems.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-white/60" />
                      <span className="text-lg text-white/80">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.article>
              <motion.article variants={fadeUp} className="rounded-lg border border-[#0b4bff]/50 bg-[#0b4bff]/15 p-7" data-testid="card-after">
                <div className="mb-6 text-sm font-medium uppercase tracking-widest text-white">{t("home.beforeAfter.afterLabel")}</div>
                <ul className="space-y-4">
                  {afterItems.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-white" />
                      <span className="text-lg text-white/90">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.article>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-24 bg-white py-20 lg:py-24" data-testid="section-process">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <motion.p variants={fadeUp} className={sectionLabel}>
                {t("home.process.sectionLabel")}
              </motion.p>
              <motion.h2 variants={fadeUp} className={sectionTitle} data-testid="text-process-title">
                {t("home.process.title")}
              </motion.h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {processSteps.map((item) => (
                <motion.article key={item.step} variants={fadeUp} className={`${cardClass} p-6`}>
                  <div className="mb-5 text-5xl font-medium text-[#dfe4f0]">{item.step}</div>
                  <h3 className="mb-3 text-xl font-medium text-[#061a3d]">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-[#6b7185]">{item.desc}</p>
                </motion.article>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-[#f6f7fb] py-20 lg:py-24" data-testid="section-testimonials">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <motion.p variants={fadeUp} className={sectionLabel}>
                {t("home.testimonials.sectionLabel")}
              </motion.p>
              <motion.h2 variants={fadeUp} className={sectionTitle} data-testid="text-testimonials-title">
                {t("home.testimonials.title1")}{" "}
                <span className="text-[#0b4bff]">{t("home.testimonials.titleAccent")}</span>
              </motion.h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <motion.article key={testimonial.name} variants={fadeUp} className={`${cardClass} p-7`} data-testid={`card-testimonial-${testimonial.name.split(" ")[0].toLowerCase()}`}>
                  <div className="mb-4 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="h-4 w-4 fill-[#0b4bff] text-[#0b4bff]" />
                    ))}
                  </div>
                  <p className="mb-6 leading-relaxed text-[#6b7185]">"{testimonial.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-[#061a3d] text-sm font-medium text-white">
                      {testimonial.name.split(" ").map((n: string) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="font-medium text-[#061a3d]">{testimonial.name}</p>
                      <p className="text-sm text-[#6b7185]">{testimonial.business} · {testimonial.trade}</p>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-white py-20 lg:py-24" data-testid="section-faq">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="mb-10 text-center">
              <motion.p variants={fadeUp} className={sectionLabel}>
                {t("home.faq.sectionLabel")}
              </motion.p>
              <motion.h2 variants={fadeUp} className={sectionTitle} data-testid="text-faq-title">
                {t("home.faq.title")}
              </motion.h2>
            </div>
            <motion.div variants={fadeUp} className={cardClass}>
              <div className="px-6">
                {faqs.map((faq) => (
                  <FAQItem key={faq.q} q={faq.q} a={faq.a} />
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="bg-[#061a3d] py-20 text-white lg:py-24" data-testid="section-cta">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-lg bg-white/10">
              <BarChart3 className="h-6 w-6" />
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl font-medium leading-[1.08] text-white sm:text-4xl lg:text-5xl" data-testid="text-cta-title">
              {t("home.cta.title")}
            </motion.h2>
            <motion.p variants={fadeUp} className="mx-auto mt-5 max-w-2xl text-xl text-white/70">
              {t("home.cta.subtitle")}
            </motion.p>
            <motion.div variants={fadeUp} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/contacto">
                <Button size="lg" className={primaryButton} data-testid="button-cta-bottom">
                  {t("home.cta.button")}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href={ctaHref} target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="min-h-[44px] rounded-md border-white/25 bg-white/5 px-6 font-medium text-white hover:bg-white/10">
                  <SiWhatsapp className="h-5 w-5" />
                  {t("home.ctaButtons.whatsapp")}
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
