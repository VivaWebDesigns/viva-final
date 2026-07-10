import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  XCircle,
} from "lucide-react";
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

const sectionTitle = "text-3xl sm:text-4xl lg:text-5xl font-medium text-[#061a3d] leading-[1.08]";
const sectionCopy = "text-base sm:text-lg text-[#6b7185] leading-relaxed";
const cardClass = "rounded-lg border border-[#e8e8ec] bg-white shadow-[0_16px_44px_rgba(6,26,61,0.06)]";
const primaryButton = "rounded-md bg-[#0f659e] hover:bg-[#0b4f7d] text-white font-medium min-h-[44px] px-6";

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

  return (
    <div className="overflow-x-hidden bg-white text-[#061a3d]">
      <SEO
        title={t("home.seo.title")}
        description={t("home.seo.description")}
        path="/"
      />

      <section className="relative isolate overflow-hidden bg-[#001426] pt-[62px] text-white" data-testid="section-hero">
        <div
          className="absolute inset-0 bg-no-repeat bg-[length:100%_auto] bg-[position:center_center] max-md:bg-[length:108%_auto] max-md:bg-[position:center_42px]"
          style={{ backgroundImage: `url(${heroHeatmapUrl})` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,14,27,0.96)_0%,rgba(0,14,27,0.78)_28%,rgba(0,14,27,0.2)_62%,rgba(0,14,27,0.04)_100%)] max-md:bg-[linear-gradient(180deg,rgba(0,14,27,0.58)_0%,rgba(0,14,27,0.16)_32%,rgba(0,14,27,0.86)_70%,rgba(0,14,27,0.98)_100%)]" />
        <div className="pointer-events-none absolute right-3 top-[26px] z-10 w-[100px] rounded-md border border-white/20 bg-[#000818] px-2 py-1.5 text-white shadow-[0_0_18px_rgba(0,0,0,0.36)] md:bottom-[clamp(44px,8vw,86px)] md:right-[clamp(28px,6vw,116px)] md:top-auto md:w-[clamp(124px,13vw,172px)] md:px-[clamp(10px,1vw,14px)] md:py-[clamp(8px,0.8vw,12px)]" aria-hidden="true">
          <div className="text-center text-[8px] font-semibold uppercase leading-none md:text-[clamp(10px,0.75vw,12px)]">Visibility Level</div>
          <div className="mt-1.5 h-[7px] rounded-full bg-[linear-gradient(90deg,#014B77_0%,#29E0F8_100%)] md:mt-2 md:h-[clamp(8px,0.75vw,11px)]" />
          <div className="mt-1 flex justify-between text-[8px] uppercase leading-none md:text-[clamp(9px,0.65vw,11px)]">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        <div className="relative z-10 mx-auto flex min-h-[648px] max-w-7xl flex-col px-4 py-7 sm:px-6 md:min-h-[556px] lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="mb-0 mt-[278px] max-w-[355px] drop-shadow-[0_2px_10px_rgba(0,0,0,0.72)] md:mb-5 md:mt-[36px]" data-testid="card-hero-content">
            <motion.h1 variants={fadeUp} className="text-[clamp(34px,4.3vw,60px)] font-extrabold uppercase leading-none tracking-[0.01em] text-white" data-testid="text-hero-title">
              Get found.
              <span className="block text-[#016192]">Get called.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-5 max-w-xs text-2xl font-medium leading-[1.28] text-white/90 md:text-[clamp(24px,2.4vw,34px)]" data-testid="text-hero-subtitle">
              We scan your website and Google rankings to show exactly why you're not showing up — and how to fix it.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-7">
              <a href="/scan.html">
                <Button size="lg" className={primaryButton} data-testid="button-hero-scan">
                  Get My Free Visibility Scan
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="bg-white py-20 lg:py-24" data-testid="section-problem">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <motion.h2 variants={fadeUp} className={sectionTitle} data-testid="text-problem-title">
                {t("home.problem.title1")}{" "}
                <span className="text-[#0f659e]">{t("home.problem.titleAccent")}</span>
              </motion.h2>
              <motion.p variants={fadeUp} className={`${sectionCopy} mt-5`}>
                {t("home.problem.subtitle")}
              </motion.p>
            </div>
            <motion.div variants={fadeUp} className="mx-auto grid max-w-4xl gap-3">
              {problemItems.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-lg bg-[#f6f7fb] p-4 text-lg font-medium text-[#061a3d]">
                  <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#dc2626]" />
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

      <section className="bg-[#061a3d] py-20 text-white lg:py-24" data-testid="section-before-after">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <motion.h2 variants={fadeUp} className="text-3xl font-medium leading-[1.08] text-white sm:text-4xl lg:text-5xl" data-testid="text-before-after-title">
                Before vs <span className="text-[#0f659e]">After</span>
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-4 text-base text-white/70">
                Real ranking data from a real client. Same business. Same market. Sixty days apart.
              </motion.p>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              {proofScans.map((scan) => (
                <motion.article key={scan.label} variants={fadeUp} className="overflow-hidden rounded-lg bg-[#02152f] shadow-[0_18px_54px_rgba(0,0,0,0.18)]">
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

      <section className="bg-[#061a3d] py-14 text-white" data-testid="section-positioning">
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
              <motion.h2 variants={fadeUp} className={sectionTitle} data-testid="text-process-title">
                {t("home.process.title")}
              </motion.h2>
              <motion.p variants={fadeUp} className={`${sectionCopy} mt-5`} data-testid="text-process-subtitle">
                {t("home.process.subtitle")}
              </motion.p>
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

      {/* Support & Growth Plan archived in docs/archive/support-growth-plan.html. */}

      <section className="bg-white py-20 lg:py-24" data-testid="section-faq">
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
