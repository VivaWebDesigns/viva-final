import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  ChartNoAxesCombined,
  ChevronDown,
  DollarSign,
  MapPin,
  Monitor,
  MonitorUp,
  PhoneCall,
  ScanSearch,
  Star,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import SEO from "@/components/SEO";
import { t, tArr, tObjArr } from "@/content";

const heroHeatmapUrl = "/img/homepage-visibility-national-blue-20260709.webp?v=20260709-blue-national-map";
const desktopHeroHeatmapUrl = "/img/homepage-visibility-national-blue-desktop-20260713.webp?v=20260713-scan-beam";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const sectionTitle = "text-3xl sm:text-4xl lg:text-5xl font-medium text-[#061a3d] leading-[1.08]";
const sectionCopy = "text-base sm:text-lg text-[#6b7185] leading-relaxed";
const cardClass = "rounded-lg border border-[#e8e8ec] bg-white shadow-[0_16px_44px_rgba(6,26,61,0.06)]";
const primaryButton = "rounded-md bg-[#006296] hover:bg-[#004978] text-white font-medium min-h-[44px] px-6";

const proofScans = [
  {
    image: "/img/glass-door-pro-before.jpeg",
    alt: "Before heatmap showing weak local rankings within a 1.5-mile radius",
    label: "BEFORE — 1.5-MILE RADIUS",
    tone: "before",
    caption: "Ranked outside the top 20 across much of the market. Invisible on Google Maps. Losing calls to competitors in the same town.",
  },
  {
    image: "/img/glass-door-pro-after-60-days.jpeg",
    alt: "After 60 days heatmap showing improved local rankings within a 1.5-mile radius",
    label: "AFTER 60 DAYS — 1.5-MILE RADIUS",
    tone: "after",
    caption: "Significant improvement across the same 1.5-mile radius. Results were strong enough that we immediately expanded the scan to see how far they held.",
  },
  {
    image: "/img/glass-door-pro-after-60-days-12-mile.jpeg",
    alt: "After 60 days heatmap showing strong local rankings across a 12-mile radius",
    label: "AFTER 60 DAYS — 12-MILE RADIUS",
    tone: "after",
    caption: "We increased the radius by 8x. Dominant rankings across a market that previously wasn't showing the business at all.",
  },
];

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
  const faqs = tObjArr<{ q: string; a: string }>("home.faq.items").filter((faq) => {
    const question = faq.q.toLowerCase();
    return !question.includes("installments") && !question.includes("partes");
  });
  const processSteps = tObjArr<{ step: string; title: string; desc: string }>("home.process.steps");
  const problemItems = tArr("home.problem.items");
  const problemIcons = [MapPin, Monitor, Star, DollarSign];
  const processIcons = [ScanSearch, PhoneCall, MonitorUp, ChartNoAxesCombined];

  return (
    <div className="overflow-x-hidden bg-white text-[#061a3d]">
      <SEO
        title={t("home.seo.title")}
        description={t("home.seo.description")}
        path="/"
      />

      <section className="relative isolate overflow-hidden bg-[#001426] pt-[62px] text-white md:min-h-[680px] md:border-b md:border-[#29e0f8]/20 md:bg-[#000818]" data-testid="section-hero">
        <div
          className="absolute inset-0 bg-no-repeat bg-[length:108%_auto] bg-[position:center_42px] md:hidden"
          style={{ backgroundImage: `url(${heroHeatmapUrl})` }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 hidden bg-[length:100%_auto] bg-center bg-no-repeat md:block"
          style={{ backgroundImage: `url(${desktopHeroHeatmapUrl})` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,8,24,0.98)_0%,rgba(0,8,24,0.86)_31%,rgba(0,8,24,0.2)_60%,rgba(0,8,24,0.08)_100%)] max-md:bg-[linear-gradient(180deg,rgba(0,14,27,0.58)_0%,rgba(0,14,27,0.16)_32%,rgba(0,14,27,0.86)_70%,rgba(0,14,27,0.98)_100%)]" />
        <div className="pointer-events-none absolute right-3 top-[26px] z-10 w-[100px] rounded-md border border-white/20 bg-[#000818] px-2 py-1.5 text-white shadow-[0_0_18px_rgba(0,0,0,0.36)] md:bottom-[clamp(44px,8vw,86px)] md:right-[clamp(28px,6vw,116px)] md:top-auto md:w-[clamp(124px,13vw,172px)] md:px-[clamp(10px,1vw,14px)] md:py-[clamp(8px,0.8vw,12px)]" aria-hidden="true">
          <div className="text-center text-[8px] font-semibold uppercase leading-none md:text-[clamp(10px,0.75vw,12px)]">Visibility Level</div>
          <div className="mt-1.5 h-[7px] rounded-full bg-[linear-gradient(90deg,#014B77_0%,#29E0F8_100%)] md:mt-2 md:h-[clamp(8px,0.75vw,11px)]" />
          <div className="mt-1 flex justify-between text-[8px] uppercase leading-none md:text-[clamp(9px,0.65vw,11px)]">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        <div className="relative z-10 mx-auto flex min-h-[648px] max-w-7xl flex-col px-4 py-7 sm:px-6 md:min-h-[586px] md:py-11 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="mb-0 mt-[278px] max-w-[355px] drop-shadow-[0_2px_10px_rgba(0,0,0,0.72)] md:mb-5 md:mt-[54px] md:max-w-[460px]" data-testid="card-hero-content">
            <motion.h1 variants={fadeUp} className="text-[clamp(34px,4.7vw,68px)] font-extrabold uppercase leading-none tracking-[0.01em] text-white" data-testid="text-hero-title">
              Get found.
              <span className="block text-[#006296]">Get called.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-5 max-w-xs text-2xl font-medium leading-[1.28] text-white/90 md:mt-6 md:max-w-[410px] md:text-[19px] md:leading-[1.55]" data-testid="text-hero-subtitle">
              We scan your website and Google rankings to show exactly why you're not showing up — and how to fix it.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-7">
              <a href="/scan.html">
                <Button size="lg" className={primaryButton} data-testid="button-hero-scan">
                  Get My Free Visibility Scan
                </Button>
              </a>
            </motion.div>
            <motion.div variants={fadeUp} className="mt-10 hidden w-[650px] grid-cols-3 gap-[18px] md:grid" aria-label="What the visibility scan provides">
              {[
                [ScanSearch, "See exactly where you rank"],
                [ChartNoAxesCombined, "Get a clear plan to fix it"],
                [PhoneCall, "Turn visibility into more calls"],
              ].map(([Icon, label]) => (
                <div key={String(label)} className="flex items-center gap-2.5 text-xs font-semibold leading-snug text-white/80">
                  <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full border border-[#29e0f8]/30 bg-[#000818]/70">
                    <Icon className="h-[18px] w-[18px] text-[#0f659e]" />
                  </span>
                  <span>{String(label)}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
        <img src="/img/hero-divider-desktop-20260713.webp?v=20260713-angled-divider" alt="" className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[38px] w-full md:h-[60px]" aria-hidden="true" />
      </section>

      <section className="bg-[#f7f9fc] py-20 lg:py-24" data-testid="section-problem">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="md:grid md:grid-cols-[minmax(0,0.88fr)_minmax(480px,1.12fr)] md:items-center md:gap-[clamp(64px,8vw,118px)]">
              <div className="mx-auto mb-12 max-w-3xl text-center md:mx-0 md:mb-0 md:text-left">
                <motion.span variants={fadeUp} className="mb-3 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#00a9df] md:text-xs">The problem</motion.span>
                <motion.h2 variants={fadeUp} className={`${sectionTitle} md:text-[clamp(40px,4.1vw,58px)]`} data-testid="text-problem-title">
                  {t("home.problem.title1")}{" "}
                  <span className="text-[#006296]">{t("home.problem.titleAccent")}</span>
                </motion.h2>
                <motion.p variants={fadeUp} className={`${sectionCopy} mt-5 md:max-w-[470px] md:text-lg md:leading-[1.65]`}>
                  {t("home.problem.subtitle")}
                </motion.p>
              </div>
              <motion.div variants={fadeUp} className="mx-auto grid max-w-4xl gap-3 md:mx-0 md:max-w-none">
                {problemItems.map((item, index) => {
                  const ProblemIcon = problemIcons[index] ?? MapPin;
                  return (
                    <div key={item} className="flex min-h-[72px] items-center gap-3 rounded-lg border border-[#061a3d]/[0.08] bg-white p-4 text-lg font-medium text-[#061a3d] shadow-[0_12px_28px_rgba(6,26,61,0.07)] md:px-[22px] md:py-[18px] md:shadow-[0_14px_34px_rgba(6,26,61,0.07)] md:transition md:duration-200 md:hover:translate-x-1.5 md:hover:border-[#006296]/30 md:hover:shadow-[0_18px_40px_rgba(6,26,61,0.11)]">
                      <span className="grid h-[42px] w-[42px] flex-none place-items-center rounded-full bg-[#061a3d] md:h-[46px] md:w-[46px]">
                        <ProblemIcon className="h-[22px] w-[22px] text-white" />
                      </span>
                      <span>{item}</span>
                    </div>
                  );
                })}
              </motion.div>
            </div>
            <motion.p variants={fadeUp} className="mx-auto mt-10 max-w-2xl text-center text-2xl font-medium text-[#061a3d]">
              {t("home.problem.conclusion")}
            </motion.p>
          </motion.div>
        </div>
      </section>

      <section className="bg-[#061a3d] py-20 text-white md:bg-[#00162f] lg:py-24" data-testid="section-before-after">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <motion.span variants={fadeUp} className="mb-3 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#00a9df] md:text-xs">Real results</motion.span>
              <motion.h2 variants={fadeUp} className="text-3xl font-medium leading-[1.08] text-white sm:text-4xl lg:text-5xl" data-testid="text-before-after-title">
                Before vs <span className="text-[#0f659e]">After</span>
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-4 text-base text-white/70">
                Real ranking data from a real client. Same business. Same market. Sixty days apart.
              </motion.p>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              {proofScans.map((scan) => (
                <motion.article key={scan.label} variants={fadeUp} className="overflow-hidden rounded-lg bg-[#02152f] shadow-[0_18px_54px_rgba(0,0,0,0.18)] md:border md:border-[#29e0f8]/20 md:bg-[#000818]/80 md:transition md:duration-200 md:hover:-translate-y-2 md:hover:border-[#29e0f8]/50 md:hover:shadow-[0_30px_68px_rgba(0,0,0,0.4)]">
                  <img src={scan.image} alt={scan.alt} className="aspect-[1.14] w-full object-cover" loading="lazy" />
                  <div className="p-5">
                    <strong className={`text-xs font-bold uppercase tracking-wide ${scan.tone === "before" ? "text-[#d8b400]" : "text-[#0f659e]"}`}>
                      {scan.label}
                    </strong>
                    <p className="mt-3 text-sm leading-relaxed text-white/80">{scan.caption}</p>
                  </div>
                </motion.article>
              ))}
            </div>
            <motion.p variants={fadeUp} className="mx-auto mt-7 max-w-3xl text-center text-xs text-white/55">
              Glass and Door Pro, Monroe, NC. Results vary by market, competition, and how established the business is.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 text-center">
              <a href="/scan.html">
                <Button size="lg" className={primaryButton} data-testid="button-proof-scan">
                  Get Your Free Visibility Scan
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="bg-[#061a3d] py-14 text-white md:border-y md:border-[#29e0f8]/15 md:bg-[#000818]" data-testid="section-positioning">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <motion.p initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={fadeUp} className="text-2xl font-medium leading-tight text-white sm:text-3xl">
            We don't sell websites. We sell visibility. Every project starts with a scan and ends with proof — not promises.
          </motion.p>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-24 bg-white py-20 lg:py-24" data-testid="section-process">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <motion.span variants={fadeUp} className="mb-3 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#00a9df] md:text-xs">How it works</motion.span>
              <motion.h2 variants={fadeUp} className={sectionTitle} data-testid="text-process-title">
                {t("home.process.title")}
              </motion.h2>
              <motion.p variants={fadeUp} className={`${sectionCopy} mt-5`} data-testid="text-process-subtitle">
                {t("home.process.subtitle")}
              </motion.p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:mx-auto lg:max-w-[1120px] lg:grid-cols-4 lg:gap-[42px]">
              {processSteps.map((item, index) => {
                const ProcessIcon = processIcons[index] ?? ScanSearch;
                return (
                  <motion.article key={item.step} variants={fadeUp} className={`${cardClass} group p-6 lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}>
                    <div className="mb-5 flex items-center gap-3.5 text-[32px] font-medium text-[rgba(0,98,150,0.18)] lg:text-[34px]">
                      <span>{item.step}</span>
                      <span className="grid h-[54px] w-[54px] place-items-center rounded-full border border-[#006296]/20 bg-white shadow-[0_12px_26px_rgba(6,26,61,0.1),0_0_0_7px_rgba(0,169,223,0.045)] transition duration-200 group-hover:-translate-y-1 lg:h-[60px] lg:w-[60px]">
                        <ProcessIcon className="h-[25px] w-[25px] text-[#006296] lg:h-7 lg:w-7" />
                      </span>
                    </div>
                    <h3 className="mb-3 text-xl font-medium text-[#061a3d]">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-[#6b7185]">{item.desc}</p>
                  </motion.article>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Support & Growth Plan archived in docs/archive/support-growth-plan.html. */}

      <section className="bg-white py-20 md:bg-[#f7f9fc] lg:py-24" data-testid="section-faq">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="mb-10 text-center">
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

      <section className="bg-[#061a3d] py-20 text-white md:bg-[#000818] lg:py-24" data-testid="section-cta">
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
            <motion.div variants={fadeUp} className="mt-9">
              <a href="/scan.html">
                <Button size="lg" className={primaryButton} data-testid="button-cta-bottom">
                  {t("home.cta.button")}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
