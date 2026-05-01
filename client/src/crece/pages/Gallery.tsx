import { Navigation } from "@crece/components/Navigation";
import { Footer } from "@crece/components/Footer";
import { Button } from "@crece/components/ui/button";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useLanguage } from "@crece/hooks/use-language";
import { ArrowRight, X, ChevronLeft, ChevronRight } from "lucide-react";

import galleryKitchen1 from "@crece/assets/images/optimized/AdobeStock_615565130_1771521960347.webp";
import galleryLiving1 from "@crece/assets/images/optimized/AdobeStock_470165599_1771521960348.webp";
import galleryKitchen2 from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_12_19_17_PM_1771521960349.webp";
import galleryDoor from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_12_18_07_PM_1771521960349.webp";
import galleryExterior from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_12_15_32_PM_1771521960350.webp";

import galleryPorch from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_02_18_31_PM_1771528760345.webp";
import galleryFence from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_02_23_09_PM_1771529000104.webp";
import galleryFenceWhite from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_05_36_54_PM_1771541172783.webp";
import galleryFenceDark from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_05_35_34_PM_1771541172783.webp";
import galleryHallway from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_05_45_31_PM_1771541281424.webp";
import galleryLivingRoom from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_05_44_00_PM_1771541281424.webp";
import galleryBedroom from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_05_42_48_PM_1771541281424.webp";
import galleryDeckPorch from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_06_07_59_PM_1771542495142.webp";
import galleryDeckGray from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_06_07_32_PM_1771542495142.webp";
import galleryDeckCovered from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_06_03_13_PM_1771542495143.webp";
import galleryDeckStained from "@crece/assets/images/optimized/Feb_19,_2026,_06_02_24_PM_1771542495143.webp";
import galleryBedroomBlue from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_08_51_26_AM_1771595655138.webp";
import galleryFoyer from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_08_49_57_AM_1771595655139.webp";
import galleryDiningRoom from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_08_49_54_AM_1771595655139.webp";
import galleryKitchen from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_08_44_03_AM_1771595655139.webp";
import galleryExtCraftsman from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_10_18_AM_1771596640067.webp";
import galleryExtWhiteBrick from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_09_43_AM_1771596640068.webp";
import galleryExtGreenRanch from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_09_39_AM_1771596640068.webp";
import galleryExtColonial from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_09_36_AM_1771596640068.webp";
import galleryExtRanchTan from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_02_27_AM_1771596640068.webp";
import galleryExtBlueShutters from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_02_19_AM_1771596640069.webp";
import galleryCabSage from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_20_42_AM_1771597260881.webp";
import galleryCabCharcoal from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_20_20_AM_1771597260882.webp";
import galleryCabNavy from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_20_15_AM_1771597260882.webp";
import galleryCabWhite from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_20_12_AM_1771597260882.webp";
import galleryFenceBlack from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_34_38_AM_1771598093722.webp";
import galleryFenceBrown from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_34_08_AM_1771598093722.webp";
import galleryFenceRedCedar from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_34_03_AM_1771598093723.webp";
import galleryFenceHorizontal from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_09_41_12_AM_1771598503007.webp";
import galleryCommRetail from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_10_09_51_AM_1771600212443.webp";
import galleryCommWarehouse from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_10_09_46_AM_1771600212444.webp";
import galleryCommOffice from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_10_09_31_AM_1771600212444.webp";
import galleryCommRestaurant from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_10_09_28_AM_1771600212444.webp";
import galleryCommModern from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_10_09_24_AM_1771600212445.webp";

const categories = ["Interior", "Exterior", "Cabinets", "Deck", "Fence", "Commercial"] as const;
type Category = typeof categories[number];

interface GalleryImage {
  src: string;
  alt: string;
  category: Category;
  caption: string;
}

const galleryImages: GalleryImage[] = [
  {
    src: galleryKitchen1,
    alt: "Kitchen with painted blue island and white cabinets",
    category: "Cabinets",
    caption: "Kitchen Cabinet Refinish — Dilworth, Charlotte",
  },
  {
    src: galleryLiving1,
    alt: "Elegant living room with fresh paint and modern decor",
    category: "Interior",
    caption: "Living Room Repaint — Myers Park, Charlotte",
  },
  {
    src: galleryExterior,
    alt: "Beautifully painted home exterior with landscaping",
    category: "Exterior",
    caption: "Full Exterior Repaint — South Charlotte",
  },
  {
    src: galleryKitchen2,
    alt: "Modern kitchen with freshly painted white cabinets",
    category: "Cabinets",
    caption: "Cabinet Painting — Matthews, NC",
  },
  {
    src: galleryFence,
    alt: "Wooden fence with fresh stain finish",
    category: "Fence",
    caption: "Privacy Fence Staining — Pineville, NC",
  },
  {
    src: galleryFenceWhite,
    alt: "White picket fence with fresh paint and garden landscaping",
    category: "Fence",
    caption: "Picket Fence Painting — Matthews, NC",
  },
  {
    src: galleryFenceDark,
    alt: "Modern dark-stained horizontal fence with patio area",
    category: "Fence",
    caption: "Privacy Fence Staining — South Charlotte",
  },
  {
    src: galleryDeckPorch,
    alt: "Front porch with blue-gray painted deck and white railings",
    category: "Deck",
    caption: "Front Porch Deck Painting — Matthews, NC",
  },
  {
    src: galleryDeckGray,
    alt: "Gray composite deck with black metal railings and outdoor seating",
    category: "Deck",
    caption: "Backyard Deck Staining — Indian Trail, NC",
  },
  {
    src: galleryDeckCovered,
    alt: "Covered porch with natural wood stained deck and outdoor furniture",
    category: "Deck",
    caption: "Covered Porch Staining — Waxhaw, NC",
  },
  {
    src: galleryDeckStained,
    alt: "Large backyard deck with rich wood stain finish",
    category: "Deck",
    caption: "Deck Refinishing — Concord, NC",
  },
  {
    src: galleryHallway,
    alt: "Freshly painted hallway with white trim and stair railing",
    category: "Interior",
    caption: "Hallway & Trim Repaint — Huntersville, NC",
  },
  {
    src: galleryLivingRoom,
    alt: "Warm neutral living room with fresh paint and crown molding",
    category: "Interior",
    caption: "Living Room Refresh — Ballantyne, Charlotte",
  },
  {
    src: galleryBedroom,
    alt: "Bedroom with navy accent wall and light gray walls",
    category: "Interior",
    caption: "Accent Wall & Bedroom — Myers Park, Charlotte",
  },
  {
    src: galleryBedroomBlue,
    alt: "Serene bedroom with soft blue-gray walls and white trim",
    category: "Interior",
    caption: "Master Bedroom Painting — Mint Hill, NC",
  },
  {
    src: galleryFoyer,
    alt: "Foyer and staircase with warm neutral walls and white trim",
    category: "Interior",
    caption: "Foyer & Staircase — Dilworth, Charlotte",
  },
  {
    src: galleryDiningRoom,
    alt: "Dining room with deep green walls and white wainscoting",
    category: "Interior",
    caption: "Dining Room & Wainscoting — Plaza Midwood, Charlotte",
  },
  {
    src: galleryKitchen,
    alt: "Kitchen with white painted cabinets and teal accent wall",
    category: "Interior",
    caption: "Kitchen Repaint — Fort Mill, SC",
  },
  {
    src: galleryExtCraftsman,
    alt: "Craftsman-style brick home with dark green trim and stone columns",
    category: "Exterior",
    caption: "Exterior Trim & Door — NoDa, Charlotte",
  },
  {
    src: galleryExtWhiteBrick,
    alt: "White painted brick farmhouse with black windows and metal roof",
    category: "Exterior",
    caption: "Full Brick Painting — Weddington, NC",
  },
  {
    src: galleryExtGreenRanch,
    alt: "Sage green painted brick ranch with white trim and carport",
    category: "Exterior",
    caption: "Brick Ranch Repaint — Gastonia, NC",
  },
  {
    src: galleryExtColonial,
    alt: "Tan painted brick colonial with white trim and portico",
    category: "Exterior",
    caption: "Colonial Exterior — South Charlotte",
  },
  {
    src: galleryExtRanchTan,
    alt: "Light tan painted brick ranch home with white trim",
    category: "Exterior",
    caption: "Brick Ranch Painting — Matthews, NC",
  },
  {
    src: galleryExtBlueShutters,
    alt: "Blue-gray painted brick home with cedar shutters and white columns",
    category: "Exterior",
    caption: "Full Exterior Painting — Huntersville, NC",
  },
  {
    src: galleryDoor,
    alt: "Beautiful blue front door with glass panels",
    category: "Exterior",
    caption: "Front Door & Trim — Ballantyne, Charlotte",
  },
  {
    src: galleryPorch,
    alt: "Covered porch with freshly painted ceiling and trim",
    category: "Exterior",
    caption: "Porch Ceiling & Trim — Mint Hill, NC",
  },
  {
    src: galleryCabSage,
    alt: "Modern kitchen with sage green painted cabinets and open shelving",
    category: "Cabinets",
    caption: "Sage Green Cabinets — Dilworth, Charlotte",
  },
  {
    src: galleryCabCharcoal,
    alt: "Kitchen with dark charcoal painted cabinets and farmhouse sink",
    category: "Cabinets",
    caption: "Charcoal Cabinet Painting — Ballantyne, Charlotte",
  },
  {
    src: galleryCabNavy,
    alt: "Kitchen with navy blue painted cabinets and white island countertop",
    category: "Cabinets",
    caption: "Navy Cabinet Refinishing — Myers Park, Charlotte",
  },
  {
    src: galleryCabWhite,
    alt: "Classic white painted kitchen cabinets with butcher block countertops",
    category: "Cabinets",
    caption: "White Cabinet Painting — Indian Trail, NC",
  },
  {
    src: galleryFenceBlack,
    alt: "Black stained privacy fence with landscaping and stone accents",
    category: "Fence",
    caption: "Black Fence Staining — Waxhaw, NC",
  },
  {
    src: galleryFenceBrown,
    alt: "Rich brown stained cedar privacy fence along driveway",
    category: "Fence",
    caption: "Cedar Fence Staining — Concord, NC",
  },
  {
    src: galleryFenceRedCedar,
    alt: "Red cedar stained privacy fence with fire pit area",
    category: "Fence",
    caption: "Cedar Fence Refinishing — Fort Mill, SC",
  },
  {
    src: galleryFenceHorizontal,
    alt: "Horizontal cedar fence with warm honey stain finish",
    category: "Fence",
    caption: "Horizontal Fence Staining — Matthews, NC",
  },
  {
    src: galleryCommRetail,
    alt: "Freshly painted retail strip center with cream stucco and black trim",
    category: "Commercial",
    caption: "Retail Center Painting — South Charlotte",
  },
  {
    src: galleryCommWarehouse,
    alt: "Green painted brick warehouse building with industrial windows",
    category: "Commercial",
    caption: "Warehouse Exterior — NoDa, Charlotte",
  },
  {
    src: galleryCommOffice,
    alt: "Professional office building with tan exterior and white columns",
    category: "Commercial",
    caption: "Office Building — Ballantyne, Charlotte",
  },
  {
    src: galleryCommRestaurant,
    alt: "Restaurant exterior with warm orange stucco and outdoor patio",
    category: "Commercial",
    caption: "Restaurant Repaint — Huntersville, NC",
  },
  {
    src: galleryCommModern,
    alt: "Modern commercial building with gray stucco and large windows",
    category: "Commercial",
    caption: "Commercial Office — South End, Charlotte",
  },
];

export default function Gallery() {
  const { t, language } = useLanguage();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("Interior");

  const payload = window.__PREVIEW__?.payload || null;
  const previewImages: { url: string; alt: string }[] | null = payload?.galleryImages || null;

  useEffect(() => {
    if (payload) {
      const biz = payload.businessName || "Professional Contractor";
      const trade = payload.tradeName || "Services";
      document.title = language === "en" ? `Project Gallery | ${biz}` : `Galería de Proyectos | ${biz}`;
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", `Browse our gallery of completed ${trade} projects. Professional work in ${payload.city || "your area"}.`);
    } else {
      document.title = language === "en" ? "Project Gallery | Charlotte Painting Pro" : "Galería de Proyectos | Charlotte Painting Pro";
      const meta = document.querySelector('meta[name="description"]');
      if (meta) {
        meta.setAttribute("content", language === "en"
          ? "Browse our gallery of completed painting projects across Charlotte, NC. Interior painting, exterior painting, cabinet refinishing, and deck & fence staining."
          : "Explore nuestra galería de proyectos de pintura completados en Charlotte, NC. Pintura de interiores, pintura de exteriores, refinado de gabinetes y teñido de terrazas y cercas.");
      }
    }
    window.scrollTo(0, 0);
  }, [language, payload]);

  const filtered = galleryImages.filter((img) => (img as any).category === activeCategory);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <section className="pt-16 pb-8 md:pt-24 md:pb-12">
        <div className="container mx-auto px-4 md:px-6 text-center max-w-3xl">
          <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t("gallery.subtitle")}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            {t("gallery.title")}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t("gallery.desc")}
          </p>
        </div>
      </section>


      {!previewImages && (
        <section className="pb-4">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={activeCategory === cat ? "default" : "outline"}
                  onClick={() => setActiveCategory(cat)}
                  data-testid={`button-filter-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {language === "en" ? cat : (
                    cat === "Interior" ? "Interior" :
                    cat === "Exterior" ? "Exterior" :
                    cat === "Cabinets" ? "Gabinetes" :
                    cat === "Deck" ? "Terraza" :
                    cat === "Fence" ? "Cerca" :
                    cat === "Commercial" ? "Comercial" : cat
                  )}
                </Button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(previewImages || filtered).map((img, i) => {
              const src = (img as any).url || (img as any).src;
              const alt = (img as any).alt;
              return (
              <motion.div
                key={src + i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="rounded-md overflow-hidden border border-border bg-card shadow-sm cursor-pointer group"
                onClick={() => setLightboxIndex(i)}
                data-testid={`card-gallery-${i}`}
              >
                <div className="overflow-hidden">
                  <img
                    src={src}
                    alt={alt}
                    width={1200}
                    height={800}
                    loading="lazy"
                    className="w-full h-[240px] md:h-[280px] object-cover transition-transform duration-300 group-hover:scale-105"
                    data-testid={`img-gallery-${i}`}
                  />
                </div>
                {!previewImages && (
                <div className="p-4">
                  <p className="text-foreground font-semibold text-sm">
                    {language === "en" ? (img as any).caption : (img as any).caption.replace("Kitchen Cabinet Refinish", "Refinado de Gabinetes de Cocina")
                      .replace("Living Room Repaint", "Repintado de Sala")
                      .replace("Full Exterior Repaint", "Repintado Exterior Completo")
                      .replace("Cabinet Painting", "Pintura de Gabinetes")
                      .replace("Privacy Fence Staining", "Teñido de Cerca de Privacidad")
                      .replace("Picket Fence Painting", "Pintura de Cerca de Estacas")
                      .replace("Front Porch Deck Painting", "Pintura de Terraza de Porche")
                      .replace("Backyard Deck Staining", "Teñido de Terraza de Patio")
                      .replace("Covered Porch Staining", "Teñido de Porche Cubierto")
                      .replace("Deck Refinishing", "Refinado de Terraza")
                      .replace("Hallway & Trim Repaint", "Repintado de Pasillo y Molduras")
                      .replace("Living Room Refresh", "Refresco de Sala")
                      .replace("Accent Wall & Bedroom", "Pared de Acento y Dormitorio")
                      .replace("Master Bedroom Painting", "Pintura de Dormitorio Principal")
                      .replace("Foyer & Staircase", "Foyer y Escalera")
                      .replace("Dining Room & Wainscoting", "Comedor y Revestimiento")
                      .replace("Kitchen Repaint", "Repintado de Cocina")
                      .replace("Exterior Trim & Door", "Molduras y Puerta Exterior")
                      .replace("Full Brick Painting", "Pintura de Ladrillo Completa")
                      .replace("Brick Ranch Repaint", "Repintado de Rancho de Ladrillo")
                      .replace("Colonial Exterior", "Exterior Colonial")
                      .replace("Brick Ranch Painting", "Pintura de Rancho de Ladrillo")
                      .replace("Full Exterior Painting", "Pintura Exterior Completa")
                      .replace("Front Door & Trim", "Puerta Principal y Molduras")
                      .replace("Porch Ceiling & Trim", "Techo de Porche y Molduras")
                      .replace("Sage Green Cabinets", "Gabinetes Verde Salvia")
                      .replace("Charcoal Cabinet Painting", "Pintura de Gabinetes Carbón")
                      .replace("Navy Cabinet Refinishing", "Refinado de Gabinetes Azul Marino")
                      .replace("White Cabinet Painting", "Pintura de Gabinetes Blancos")
                      .replace("Black Fence Staining", "Teñido de Cerca Negra")
                      .replace("Cedar Fence Staining", "Teñido de Cerca de Cedro")
                      .replace("Cedar Fence Refinishing", "Refinado de Cerca de Cedro")
                      .replace("Horizontal Fence Staining", "Teñido de Cerca Horizontal")
                      .replace("Retail Center Painting", "Pintura de Centro Minorista")
                      .replace("Warehouse Exterior", "Exterior de Almacén")
                      .replace("Office Building", "Edificio de Oficinas")
                      .replace("Restaurant Repaint", "Repintado de Restaurante")
                      .replace("Commercial Office", "Oficina Comercial")
                    }
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {language === "en" ? (img as any).category : (
                      (img as any).category === "Interior" ? "Interior" :
                      (img as any).category === "Exterior" ? "Exterior" :
                      (img as any).category === "Cabinets" ? "Gabinetes" :
                      (img as any).category === "Deck" ? "Terraza" :
                      (img as any).category === "Fence" ? "Cerca" :
                      (img as any).category === "Commercial" ? "Comercial" : (img as any).category
                    )}
                  </p>
                </div>
                )}
              </motion.div>
              );
            })}
          </div>

          {!previewImages && filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-12">
              {t("gallery.noProjects")}
            </p>
          )}
        </div>
      </section>

      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4 md:px-6 text-center max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            {t("gallery.cta.title")}
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            {t("gallery.cta.desc")}
          </p>
          <Link href="/contact">
            <Button data-testid="button-gallery-cta" className="bg-primary text-primary-foreground font-semibold px-8 h-12 text-base">
              {t("nav.freeEstimate")}
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
          {lightboxIndex < (previewImages || filtered).length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 z-10 transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              data-testid="button-lightbox-next"
            >
              <ChevronRight size={32} />
            </button>
          )}
          {(() => {
            const activeImages = previewImages || filtered;
            const cur = activeImages[lightboxIndex];
            const src = (cur as any).url || (cur as any).src;
            const alt = (cur as any).alt;
            return (
              <img
                src={src}
                alt={alt}
                className="max-w-full max-h-[90vh] object-contain rounded-md"
                onClick={(e) => e.stopPropagation()}
                data-testid="img-lightbox"
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}
