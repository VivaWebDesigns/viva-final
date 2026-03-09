import { Navigation } from "@empieza/components/Navigation";
import { ServiceCard } from "@empieza/components/ServiceCard";
import { ReviewCard } from "@empieza/components/ReviewCard";
import { ContactForm } from "@empieza/components/ContactForm";
import { Button } from "@empieza/components/ui/button";
import { Link } from "react-scroll";
import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@empieza/hooks/use-language";
import logoImg from "@assets/icon_1772859694792.png";
import { SiWhatsapp } from "react-icons/si";
import {
  Paintbrush, PaintBucket,
  Home as HomeIcon,
  Layers, Sun,
  Phone, Mail, MapPin, CheckCircle2, ArrowRight, ShieldCheck, Clock, Star, X, Fence,
  Building2, Wrench, Droplets, Zap, AlertTriangle,
  HardHat, Cloud, Shield, CircuitBoard, Lightbulb, Truck,
  Leaf, Flower2, TreePine,
  Thermometer, Fan, Wind, Hammer, ShowerHead,
} from "lucide-react";
import { SiTiktok, SiYoutube, SiFacebook, SiInstagram } from "react-icons/si";
import heroVideoMp4 from "@empieza/assets/videos/hero-painting-optimized.mp4";
import heroVideoWebm from "@empieza/assets/videos/hero-painting-optimized.webm";
import heroPoster from "@empieza/assets/videos/poster.webp";
import aboutPhoto from "@empieza/assets/images/optimized/gabriel-tovar-En1Is3KsRZw-unsplash_1771517255358.webp";
import galleryKitchen1 from "@empieza/assets/images/optimized/AdobeStock_615565130_1771521960347.webp";
import galleryLiving1 from "@empieza/assets/images/optimized/AdobeStock_470165599_1771521960348.webp";
import galleryKitchen2 from "@empieza/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_12_19_17_PM_1771521960349.webp";
import galleryDoor from "@empieza/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_12_18_07_PM_1771521960349.webp";
import galleryExterior from "@empieza/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_12_15_32_PM_1771521960350.webp";
import galleryLiving2 from "@empieza/assets/images/optimized/AdobeStock_248267632_1771521960350.webp";
import galleryPorch from "@empieza/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_02_18_31_PM_1771528760345.webp";
import galleryFence from "@empieza/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_02_23_09_PM_1771529000104.webp";

const ICON_MAP: Record<string, any> = {
  PaintBucket, Paintbrush,
  Home: HomeIcon,
  Layers, Sun, Fence, Building2,
  Wrench, Droplets, Zap, AlertTriangle, ShowerHead,
  HardHat, Cloud, Shield, CircuitBoard, Lightbulb, Truck,
  Leaf, Flower2, TreePine,
  Thermometer, Fan, Wind, Hammer,
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const { t } = useLanguage();
  const P = (window as any).__PREVIEW__?.payload ?? null;

  useEffect(() => {
    if (!P && videoRef.current) {
      videoRef.current.playbackRate = 0.7;
    }
    if (P) {
      document.title = `${P.businessName} | ${P.tradeName} in ${P.city}`;
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", `${P.businessName} offers professional ${P.tradeNoun} services in ${P.city}. Get a free estimate today.`);
    }
  }, []);

  const phone     = P?.phone || "(704) 555-0123";
  const email     = P?.email || "quotes@charlottepaintingpro.com";
  const phoneRaw  = phone.replace(/\D/g, "");
  const bizName   = P?.businessName || "Charlotte Painting Pro";
  const serviceArea = P ? `${P.city} and surrounding area` : "Charlotte, Matthews, Mint Hill, Pineville, Huntersville, Concord, Gastonia, Fort Mill";

  const defaultGallery = [galleryKitchen1, galleryExterior, galleryLiving1, galleryDoor, galleryKitchen2, galleryPorch, galleryFence];
  const defaultGalleryAlts = [
    "Beautiful kitchen with painted blue island",
    "Beautifully painted home exterior",
    "Elegant living room interior",
    "Beautiful blue front door",
    "Kitchen with painted cabinets",
    "Beautifully painted covered porch",
    "Stained wooden fence",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      {/* Hero Section */}
      <section id="home" className="relative min-h-[80vh] flex items-center">
        <div className="absolute inset-0 z-0">
          {P?.heroImageUrl ? (
            <img
              src={P.heroImageUrl}
              alt={P.tradeName}
              className="w-full h-full object-cover"
              data-testid="img-hero"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              poster={heroPoster}
              className="w-full h-full object-cover"
              data-testid="video-hero"
            >
              <source src={heroVideoWebm} type="video/webm" />
              <source src={heroVideoMp4} type="video/mp4" />
            </video>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/70 to-black/50" />
        </div>

        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl space-y-6"
          >
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight text-white" style={{ fontFamily: 'var(--font-display)' }}>
              {P ? (
                t("heroTitle")
              ) : (
                <>
                  {t("heroTitle").split("painting needs")[0]}
                  <span className="text-white/90">{t("heroTitle").includes("painting needs") ? "painting needs" : "necesidades de pintura"}</span>{" "}
                  {t("heroTitle").split("painting needs")[1] || t("heroTitle").split("necesidades de pintura")[1] || ""}
                </>
              )}
            </h1>

            <p className="text-lg md:text-xl text-white/70 max-w-2xl leading-relaxed">
              {t("heroSubtitle")}
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap gap-4 pt-4">
              <Link to="contact" smooth={true} duration={500} offset={-50}>
                <Button data-testid="button-hero-cta" className="bg-primary text-primary-foreground font-semibold px-8 h-12 text-base border border-primary">
                  {t("getFreeEstimate")}
                  <ArrowRight className="ml-2" size={18} />
                </Button>
              </Link>
              <Link to="services" smooth={true} duration={500} offset={-80}>
                <Button data-testid="button-hero-services" variant="outline" className="border-white/30 text-white font-semibold px-8 h-12 text-base bg-white/5 backdrop-blur-sm">
                  {t("viewServices")}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-12 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t("aboutUs")}</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>
                {t("hiDavid")}
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                {t("aboutP1")}
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                {t("aboutP2")}
              </p>

              <div className="flex flex-wrap gap-8">
                <div>
                  <span className="block text-3xl font-bold text-primary" style={{ fontFamily: 'var(--font-display)' }}>15+</span>
                  <span className="text-muted-foreground text-sm font-medium">{t("yearsExperience")}</span>
                </div>
                <div>
                  <span className="block text-3xl font-bold text-primary" style={{ fontFamily: 'var(--font-display)' }}>500+</span>
                  <span className="text-muted-foreground text-sm font-medium">{t("happyHomes")}</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="rounded-md overflow-hidden shadow-lg">
                <img
                  src={P?.aboutImageUrl || aboutPhoto}
                  alt={P ? `${bizName} team` : "David Martinez and family"}
                  className="w-full h-[300px] md:h-[400px] object-cover object-[60%_center] md:object-[center_20%]"
                  data-testid="img-about"
                />
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white border border-border p-4 rounded-md hidden md:flex items-center gap-3 shadow-md">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <span className="block text-foreground font-semibold text-sm">{t("satisfaction")}</span>
                  <span className="text-muted-foreground text-xs">{t("satisfactionSub")}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="pt-16 pb-24 md:py-24 bg-secondary">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t("ourExpertise")}</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              {t("qualityServices")}
            </h2>
            <p className="text-muted-foreground">
              {t("servicesSub")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {P?.services ? (
              P.services.map((s: any, i: number) => (
                <ServiceCard
                  key={i}
                  title={s.title}
                  description={s.description}
                  benefits={s.benefits}
                  icon={ICON_MAP[s.iconName] || Paintbrush}
                  delay={(i + 1) * 0.1}
                  imageUrl=""
                />
              ))
            ) : (
              <>
                <ServiceCard title={t("service1Title")} description={t("service1Desc")} benefits={[t("service1B1"), t("service1B2"), t("service1B3")]} icon={Paintbrush} delay={0.1} imageUrl="" />
                <ServiceCard title={t("service2Title")} description={t("service2Desc")} benefits={[t("service2B1"), t("service2B2"), t("service2B3")]} icon={HomeIcon} delay={0.2} imageUrl="" />
                <ServiceCard title={t("service3Title")} description={t("service3Desc")} benefits={[t("service3B1"), t("service3B2"), t("service3B3")]} icon={Layers} delay={0.3} imageUrl="" />
                <ServiceCard title={t("service4Title")} description={t("service4Desc")} benefits={[t("service4B1"), t("service4B2"), t("service4B3")]} icon={Sun} delay={0.4} imageUrl="" />
                <ServiceCard title={t("service5Title")} description={t("service5Desc")} benefits={[t("service5B1"), t("service5B2"), t("service5B3")]} icon={Fence} delay={0.5} imageUrl="" />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Why Us Section */}
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t("whyUs")}</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>
                {t("qualityCountOn")}
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                {t("whyUsP1")}
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                {t("whyUsP2")}
              </p>

              <div className="flex flex-col sm:flex-row flex-wrap gap-4">
                <div className="flex items-center gap-3 text-foreground/70">
                  <ShieldCheck size={20} className="text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{t("fullyInsured")}</span>
                </div>
                <div className="flex items-center gap-3 text-foreground/70">
                  <Clock size={20} className="text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{t("onTimeGuarantee")}</span>
                </div>
                <div className="flex items-center gap-3 text-foreground/70">
                  <CheckCircle2 size={20} className="text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{t("cleanWork")}</span>
                </div>
              </div>

              <div className="mt-8">
                <Link to="contact" smooth={true} duration={500} offset={-50}>
                  <Button data-testid="button-why-cta" className="bg-primary text-primary-foreground font-semibold px-8 h-12">
                    {t("contact")}
                    <ArrowRight className="ml-2" size={18} />
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              {(() => {
                const imgs = P?.galleryImages || defaultGallery.map((src, i) => ({ url: src, alt: defaultGalleryAlts[i] }));
                return (
                  <>
                    <div className="relative rounded-md overflow-hidden shadow-lg mb-4 cursor-pointer" onClick={() => setLightboxSrc(imgs[0].url)}>
                      <img src={imgs[0].url} alt={imgs[0].alt} loading="lazy" className="w-full h-[280px] object-cover" data-testid="img-why-us-1" />
                      <div className="absolute bottom-0 right-0 z-10 bg-primary text-white px-4 py-2 rounded-tl-md shadow-lg text-center">
                        <span className="block text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>15+</span>
                        <span className="text-[10px] font-medium tracking-wider uppercase">{t("yearsExperience")}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {imgs.slice(1, 7).map((img: any, i: number) => (
                        <div key={i} className="rounded-md overflow-hidden shadow-md cursor-pointer" onClick={() => setLightboxSrc(img.url)}>
                          <img src={img.url} alt={img.alt} loading="lazy" className="w-full h-[160px] object-cover" data-testid={`img-why-us-${i + 2}`} />
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section id="reviews" className="py-24 bg-secondary">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t("reviews")}</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              {t("whatClientsSay")}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {P?.reviews ? (
              P.reviews.map((r: any, i: number) => (
                <ReviewCard key={i} name={r.name} location={r.location} text={r.text} delay={(i + 1) * 0.1} />
              ))
            ) : (
              <>
                <ReviewCard name={t("review1Name")} location={t("review1Loc")} text={t("review1Text")} delay={0.1} />
                <ReviewCard name={t("review2Name")} location={t("review2Loc")} text={t("review2Text")} delay={0.2} />
                <ReviewCard name={t("review3Name")} location={t("review3Loc")} text={t("review3Text")} delay={0.3} />
                <ReviewCard name={t("review4Name")} location={t("review4Loc")} text={t("review4Text")} delay={0.4} />
                <ReviewCard name={t("review5Name")} location={t("review5Loc")} text={t("review5Text")} delay={0.5} />
              </>
            )}
          </div>

          <p className="text-center text-muted-foreground/60 text-sm mt-8">
            {t("sampleReviews")}
          </p>

          <div className="text-center mt-8">
            <Link to="contact" smooth={true} duration={500} offset={-50}>
              <Button data-testid="button-reviews-cta" className="bg-primary text-primary-foreground font-semibold px-8">
                {t("bookQuote")}
                <ArrowRight className="ml-2" size={18} />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t("contact")}</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              {t("letUsHelp")}
            </h2>
            <p className="text-muted-foreground">
              {t("contactSub")}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            <a
              href={`tel:${phoneRaw}`}
              data-testid="link-phone"
              className="group rounded-md border border-border bg-secondary p-6 flex items-center gap-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                <Phone size={24} />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground text-sm mb-0.5">{t("callUs")}</h4>
                <p className="text-muted-foreground text-sm">{phone}</p>
              </div>
              <ArrowRight size={18} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </a>

            <a
              href={`https://wa.me/${phoneRaw}`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-whatsapp"
              className="group rounded-md border border-border bg-secondary p-6 flex items-center gap-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-md bg-[#25D366]/10 flex items-center justify-center text-[#25D366]">
                <SiWhatsapp size={24} />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground text-sm mb-0.5">WhatsApp</h4>
                <p className="text-muted-foreground text-sm">{phone}</p>
              </div>
              <ArrowRight size={18} className="text-muted-foreground/40 group-hover:text-[#25D366] transition-colors" />
            </a>

            <a
              href={`mailto:${email}`}
              data-testid="link-email"
              className="group rounded-md border border-border bg-secondary p-6 flex items-center gap-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                <Mail size={24} />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground text-sm mb-0.5">{t("emailUs")}</h4>
                <p className="text-muted-foreground text-sm">{email}</p>
              </div>
              <ArrowRight size={18} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </a>
          </div>

          <div className="max-w-2xl mx-auto">
            <ContactForm />
          </div>

          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-3 text-muted-foreground text-sm">
              <MapPin size={16} className="text-primary" />
              {serviceArea}
            </div>
          </div>

          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-3 text-muted-foreground text-sm">
              <Clock size={16} className="text-primary" />
              {t("monSat")}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 bg-[#021824] relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent shadow-[0_0_70px_25px_rgba(59,130,246,0.1)] pointer-events-none" />
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              {P ? (
                P.logoUrl ? (
                  <img src={P.logoUrl} alt={bizName} className="h-8 w-auto" />
                ) : (
                  <span className="font-bold text-lg text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{bizName}</span>
                )
              ) : (
                <img src={logoImg} alt="Charlotte Painting Pro" className="h-8 w-auto" />
              )}
            </div>

            <div className="flex items-center gap-4">
              <a href="#" className="text-[#1877F2] hover:opacity-80 transition-opacity" aria-label="Facebook"><SiFacebook size={20} /></a>
              <a href="#" className="text-[#E4405F] hover:opacity-80 transition-opacity" aria-label="Instagram"><SiInstagram size={20} /></a>
              <a href="#" className="text-[#FF0000] hover:opacity-80 transition-opacity" aria-label="YouTube"><SiYoutube size={22} /></a>
              <a href="#" className="text-[#000000] hover:opacity-80 transition-opacity" aria-label="TikTok"><SiTiktok size={18} /></a>
            </div>

            <p className="text-muted-foreground text-sm">
              &copy; {new Date().getFullYear()} {bizName}. {t("rights")}
            </p>
          </div>
        </div>
      </footer>

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxSrc(null)}
          data-testid="lightbox-overlay"
        >
          <button
            className="absolute top-4 right-4 text-white p-2"
            onClick={() => setLightboxSrc(null)}
            data-testid="button-lightbox-close"
          >
            <X size={32} />
          </button>
          <img
            src={lightboxSrc}
            alt="Enlarged gallery image"
            className="max-w-full max-h-[90vh] object-contain rounded-md"
            onClick={(e) => e.stopPropagation()}
            data-testid="img-lightbox"
          />
        </div>
      )}
    </div>
  );
}
