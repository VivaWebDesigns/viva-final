import { Navigation } from "@domina/components/Navigation";
import { Footer } from "@domina/components/Footer";
import { Button } from "@domina/components/ui/button";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, X, ChevronLeft, ChevronRight } from "lucide-react";
import { allProjects, SERVICE_CATEGORIES, type ServiceCategory } from "@domina/data/projects";
import { useLanguage } from "@domina/i18n/LanguageContext";

export default function Gallery() {
  const { t } = useLanguage();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>("Interior");

  const payload = window.__PREVIEW__?.payload || null;
  const previewGalleryImages: { url: string; alt: string }[] | null = payload?.galleryImages || null;

  useEffect(() => {
    if (payload) {
      const biz = payload.businessName || "Your Business";
      document.title = `Project Gallery | ${biz}`;
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", `Browse our gallery of completed ${payload.tradeName || "contractor"} projects in ${payload.city || "your area"}.`);
    } else {
      document.title = "Project Gallery | Charlotte Painting Pro";
      const meta = document.querySelector('meta[name="description"]');
      if (meta) {
        meta.setAttribute("content", "Browse our gallery of completed painting projects across Charlotte, NC. Interior painting, exterior painting, cabinet refinishing, and deck & fence staining.");
      }
    }
    window.scrollTo(0, 0);
  }, []);

  const filtered = previewGalleryImages
    ? previewGalleryImages.map((g, i) => ({ id: i, src: g.url, alt: g.alt, caption: g.alt, category: "Interior" as ServiceCategory, location: "" }))
    : allProjects.filter((img) => img.category === activeCategory);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft" && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
      if (e.key === "ArrowRight" && lightboxIndex < filtered.length - 1) setLightboxIndex(lightboxIndex + 1);
    },
    [lightboxIndex, filtered.length]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <section className="pt-16 pb-8 md:pt-24 md:pb-12">
        <div className="container mx-auto px-4 md:px-6 text-center max-w-3xl">
          <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t.gallery.label}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            {t.gallery.title}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t.gallery.subtitle}
          </p>
        </div>
      </section>

      {!previewGalleryImages && <section className="pb-4">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-wrap justify-center gap-3">
            {SERVICE_CATEGORIES.map((cat) => (
              <Button
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                onClick={() => setActiveCategory(cat)}
                data-testid={`button-filter-${cat.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {t.gallery.categories[cat] || cat}
              </Button>
            ))}
          </div>
        </div>
      </section>}

      <section className="py-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((img, i) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="rounded-md overflow-hidden border border-border bg-card shadow-sm cursor-pointer group"
                onClick={() => setLightboxIndex(i)}
                data-testid={`card-gallery-${i}`}
              >
                <div className="overflow-hidden">
                  <img
                    src={img.src}
                    alt={img.alt}
                    width={1200}
                    height={800}
                    loading="lazy"
                    className="w-full h-[240px] md:h-[280px] object-cover transition-transform duration-300 group-hover:scale-105"
                    data-testid={`img-gallery-${i}`}
                  />
                </div>
                <div className="p-4">
                  <p className="text-foreground font-semibold text-sm">
                    {(() => {
                      const translatedCaption = t.gallery.projectCaptions?.[img.caption] || img.caption;
                      return img.location ? `${translatedCaption} — ${img.location}` : translatedCaption;
                    })()}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">{t.gallery.categories[img.category] || img.category}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-12">{t.gallery.noProjects}</p>
          )}
        </div>
      </section>

      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4 md:px-6 text-center max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            {t.gallery.likeTitle}
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            {t.gallery.likeSubtitle}
          </p>
          <Link href="/contact">
            <Button data-testid="button-gallery-cta" className="bg-primary text-primary-foreground font-semibold px-8 h-12 text-base">
              {t.gallery.getEstimate}
              <ArrowRight className="ml-2" size={18} />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxIndex(null)}
          data-testid="lightbox-overlay"
        >
          <button
            className="absolute top-4 right-4 text-white p-2 z-10"
            onClick={() => setLightboxIndex(null)}
            data-testid="button-lightbox-close"
          >
            <X size={32} />
          </button>
          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 z-10 transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              data-testid="button-lightbox-prev"
            >
              <ChevronLeft size={32} />
            </button>
          )}
          {lightboxIndex < filtered.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 z-10 transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              data-testid="button-lightbox-next"
            >
              <ChevronRight size={32} />
            </button>
          )}
          <img
            src={filtered[lightboxIndex].src}
            alt={filtered[lightboxIndex].alt}
            className="max-w-full max-h-[90vh] object-contain rounded-md"
            onClick={(e) => e.stopPropagation()}
            data-testid="img-lightbox"
          />
        </div>
      )}
    </div>
  );
}
