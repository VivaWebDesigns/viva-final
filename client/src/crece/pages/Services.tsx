import { Navigation } from "@crece/components/Navigation";
import { Footer } from "@crece/components/Footer";
import { Button } from "@crece/components/ui/button";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useLanguage } from "@crece/hooks/use-language";
import {
  PaintBucket,
  Home as HomeIcon,
  Layers,
  Sun,
  Fence,
  Building2,
  ArrowRight,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Droplets,
  ShowerHead,
  Zap,
  AlertTriangle,
  HardHat,
  Cloud,
  Shield,
  CircuitBoard,
  Lightbulb,
  Truck,
  Leaf,
  Flower2,
  TreePine,
  Thermometer,
  Fan,
  Wind,
  Hammer,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  PaintBucket, Home: HomeIcon, Layers, Sun, Fence, Building2,
  Wrench, Droplets, ShowerHead, Zap, AlertTriangle, HardHat,
  Cloud, Shield, CircuitBoard, Lightbulb, Truck, Leaf, Flower2,
  TreePine, Thermometer, Fan, Wind, Hammer,
};
import galleryKitchen1 from "@crece/assets/images/optimized/AdobeStock_615565130_1771521960347.webp";
import galleryLiving1 from "@crece/assets/images/optimized/AdobeStock_470165599_1771521960348.webp";
import galleryKitchen2 from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_12_19_17_PM_1771521960349.webp";
import galleryDoor from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_12_18_07_PM_1771521960349.webp";
import galleryExterior from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_12_15_32_PM_1771521960350.webp";
import galleryPorch from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_02_18_31_PM_1771528760345.webp";
import galleryFence from "@crece/assets/images/optimized/ChatGPT_Image_Feb_19,_2026,_02_23_09_PM_1771529000104.webp";
import serviceInterior from "@crece/assets/images/optimized/image_1771599128923.webp";
import serviceExterior from "@crece/assets/images/optimized/image_1771599160031.webp";
import serviceCabinets from "@crece/assets/images/optimized/image_1771599217947.webp";
import serviceDeck from "@crece/assets/images/optimized/image_1771599249175.webp";
import serviceFence from "@crece/assets/images/optimized/image_1771599272316.webp";
import serviceCommercial from "@crece/assets/images/optimized/ChatGPT_Image_Feb_20,_2026,_10_09_51_AM_1771600212443.webp";

interface ServiceBlockProps {
  title: string;
  description: string;
  highlights: string[];
  process?: string;
  icon: React.ElementType;
  delay: number;
  image?: string;
  imageAlt?: string;
  anchorId?: string;
}

function ServiceBlock({ title, description, highlights, process, icon: Icon, delay, image, imageAlt, anchorId }: ServiceBlockProps) {
  const { t } = useLanguage();
  return (
    <motion.div
      id={anchorId}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="rounded-md border border-border bg-card overflow-hidden flex flex-col scroll-mt-24"
      data-testid={`block-service-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {image && (
        <div className="w-full h-[220px] overflow-hidden">
          <img src={image} alt={imageAlt || title} className="w-full h-full object-cover" loading="lazy" width={1200} height={800} />
        </div>
      )}
      <div className="p-8 flex flex-col flex-1">
        <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-6">
          <Icon size={28} />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
        <p className="text-muted-foreground leading-relaxed mb-6">{description}</p>
        <ul className="space-y-3 mb-6">
          {highlights.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-foreground/70">
              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
              {item}
            </li>
          ))}
        </ul>
        {process && (
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">{process}</p>
        )}
        <div className="mt-auto">
          <Link href="/contact">
            <Button data-testid={`button-estimate-${title.toLowerCase().replace(/\s+/g, '-')}`} className="bg-primary text-primary-foreground font-semibold">
              {t("nav.freeEstimate")}
              <ArrowRight className="ml-2" size={18} />
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export default function Services() {
  const { language, t } = useLanguage();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const payload = window.__PREVIEW__?.payload || null;
  const previewServices: any[] | null = payload
    ? (language === "es" ? payload.servicesES : payload.servicesEN) || null
    : null;
  const previewGalleryImages: { url: string; alt: string }[] | null = payload?.galleryImages || null;

  useEffect(() => {
    if (payload) {
      const biz = payload.businessName || "Professional Contractor";
      const trade = payload.tradeName || "Services";
      document.title = `Our Services | ${biz}`;
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", `Professional ${trade} services in ${payload.city || "your area"}. Get a free estimate.`);
    } else {
      document.title = "Our Services | Charlotte Painting Pro";
      const meta = document.querySelector('meta[name="description"]');
      if (meta) {
        meta.setAttribute("content", "Interior painting, exterior painting, kitchen cabinet painting, and deck & fence staining services in Charlotte, NC. Get a free estimate from Charlotte Painting Pro.");
      }
    }
    const hash = window.location.hash;
    if (hash && !hash.includes("/")) {
      setTimeout(() => {
        try {
          const el = document.querySelector(hash);
          if (el) el.scrollIntoView({ behavior: "smooth" });
        } catch (_) {}
      }, 100);
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  const galleryImages = previewGalleryImages
    ? previewGalleryImages.map(g => ({ src: g.url, alt: g.alt }))
    : [
        { src: galleryKitchen1, alt: "Beautiful kitchen with painted blue island" },
        { src: galleryExterior, alt: "Beautifully painted home exterior" },
        { src: galleryLiving1, alt: "Elegant living room interior" },
        { src: galleryDoor, alt: "Beautiful blue front door" },
        { src: galleryKitchen2, alt: "Kitchen with painted cabinets" },
        { src: galleryPorch, alt: "Beautifully painted covered porch" },
        { src: galleryFence, alt: "Stained wooden fence" },
      ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <section className="pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="container mx-auto px-4 md:px-6 text-center max-w-3xl">
          <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t("nav.services")}</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            {t("services.title")}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t("services.description")}
          </p>
        </div>
      </section>

      <section className="pb-24">
        <div className="container mx-auto px-4 md:px-6">
          {previewServices ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {previewServices.map((svc: any, i: number) => {
                const Icon = ICON_MAP[svc.iconName] || Building2;
                return (
                  <motion.div
                    key={svc.title + i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                    className="rounded-md border border-border bg-card overflow-hidden flex flex-col scroll-mt-24"
                    data-testid={`block-service-${i}`}
                  >
                    <div className="p-8 flex flex-col flex-1">
                      <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center text-primary mb-6">
                        <Icon size={28} />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>{svc.title}</h2>
                      <p className="text-muted-foreground leading-relaxed mb-6">{svc.description}</p>
                      <ul className="space-y-3 mb-6">
                        {(svc.benefits || []).map((b: string, j: number) => (
                          <li key={j} className="flex items-start gap-3 text-sm text-foreground/70">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                            {b}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto">
                        <Link href="/contact">
                          <Button data-testid={`button-estimate-${i}`} className="bg-primary text-primary-foreground font-semibold">
                            {t("nav.freeEstimate")}
                            <ArrowRight className="ml-2" size={16} />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ServiceBlock
              anchorId="interior-painting"
              image={serviceInterior}
              imageAlt={language === "en" ? "Beautifully painted foyer with warm neutral walls and white trim" : "Foyer bellamente pintado con paredes neutras cálidas y molduras blancas"}
              title={t("services.interior")}
              description={language === "en" ? "A fresh coat of paint is one of the fastest ways to transform any room in your home. Whether you're updating a single accent wall or repainting your entire interior, Charlotte Painting Pro delivers clean, precise results that make your space feel brand new. We use premium paints with low-VOC formulas so your family can enjoy the finished product without harsh fumes. Every project is handled with care — we protect your furniture, floors, and fixtures throughout the process." : "Una capa de pintura fresca es una de las formas más rápidas de transformar cualquier habitación de su hogar. Ya sea que esté actualizando una sola pared de acento o repintando todo su interior, Charlotte Painting Pro ofrece resultados limpios y precisos que hacen que su espacio se sienta como nuevo. Utilizamos pinturas de primera calidad con fórmulas de bajo contenido de COV para que su familia pueda disfrutar del producto terminado sin vapores fuertes. Cada proyecto se maneja con cuidado: protegemos sus muebles, suelos y accesorios durante todo el proceso."}
              highlights={language === "en" ? [
                "Smooth, even finishes on walls, ceilings, and accent features",
                "Trim, molding, and baseboard painting with sharp, clean lines",
                "Drywall patching and surface repair included before painting",
                "Premium, low-VOC paints for a safer, longer-lasting result",
              ] : [
                "Acabados suaves y uniformes en paredes, techos y elementos decorativos",
                "Pintura de molduras y rodapiés con líneas nítidas y limpias",
                "Parcheo de paneles de yeso y reparación de superficies incluidos antes de pintar",
                "Pinturas premium de bajo COV para un resultado más seguro y duradero",
              ]}
              process={language === "en" ? "We start by covering and protecting all surfaces, then fill any holes or imperfections. Surfaces are sanded and primed before we apply two coats of your chosen color. We finish with a full cleanup so you can enjoy your new space right away." : "Comenzamos cubriendo y protegiendo todas las superficies, luego rellenamos cualquier agujero o imperfección. Las superficies se lijan y se impriman antes de aplicar dos capas del color elegido. Terminamos con una limpieza completa para que pueda disfrutar de su nuevo espacio de inmediato."}
              icon={PaintBucket}
              delay={0.1}
            />
            <ServiceBlock
              anchorId="exterior-painting"
              image={serviceExterior}
              imageAlt={language === "en" ? "White painted brick home with navy shutters and landscaping at dusk" : "Casa de ladrillo pintada de blanco con persianas azul marino y paisajismo al anochecer"}
              title={t("services.exterior")}
              description={language === "en" ? "Your home's exterior is the first thing people notice. Charlotte's heat, humidity, and seasonal storms can take a toll on paint over time, leading to peeling, fading, and wood damage. Our exterior painting service restores your home's curb appeal and adds a layer of protection against the elements. We use weather-resistant, high-durability coatings designed to hold up in the Carolina climate for years to come." : "El exterior de su hogar es lo primero que la gente nota. El calor, la humedad y las tormentas estacionales de Charlotte pueden afectar la pintura con el tiempo, provocando descascarado, decoloración y daños en la madera. Nuestro servicio de pintura exterior restaura el atractivo visual de su hogar y agrega una capa de protección contra los elementos. Utilizamos revestimientos de alta durabilidad y resistentes a la intemperie diseñados para resistir el clima de las Carolinas durante los próximos años."}
              highlights={language === "en" ? [
                "Full exterior coverage including siding, brick, stucco, and wood",
                "Shutters, fascia, soffit, and trim painted with precision",
                "Pressure washing and thorough surface prep before any paint is applied",
                "UV-resistant and weather-rated paints for long-lasting color",
              ] : [
                "Cobertura exterior completa que incluye revestimiento, ladrillo, estuco y madera",
                "Persianas, salpicaderos, plafones y molduras pintados con precisión",
                "Lavado a presión y preparación exhaustiva de la superficie antes de aplicar cualquier pintura",
                "Pinturas resistentes a los rayos UV y a la intemperie para un color duradero",
              ]}
              process={language === "en" ? "Every exterior job begins with a pressure wash to remove dirt, mildew, and loose paint. We scrape, sand, and prime any trouble spots before applying two coats of premium exterior paint. All landscaping and surfaces are protected throughout the project." : "Cada trabajo exterior comienza con un lavado a presión para eliminar la suciedad, el moho y la pintura suelta. Raspamos, lijamos e imprimamos cualquier punto problemático antes de aplicar dos capas de pintura exterior premium. Todos los jardines y superficies están protegidos durante todo el proyecto."}
              icon={HomeIcon}
              delay={0.2}
            />
            <ServiceBlock
              anchorId="kitchen-cabinet-painting"
              image={serviceCabinets}
              imageAlt={language === "en" ? "Modern kitchen with white cabinets and blue painted island" : "Cocina moderna con gabinetes blancos e isla pintada de azul"}
              title={t("services.cabinets")}
              description={language === "en" ? "Replacing kitchen cabinets can cost thousands. A professional cabinet painting job delivers the same dramatic transformation at a fraction of the price. Charlotte Painting Pro specializes in smooth, factory-quality finishes that completely modernize your kitchen. We take the time to properly prep every surface — removing doors, sanding, priming, and applying multiple coats — so the finished product looks and feels like brand-new cabinetry." : "Reemplazar los gabinetes de la cocina puede costar miles. Un trabajo profesional de pintura de gabinetes ofrece la misma transformación dramática a una fracción del precio. Charlotte Painting Pro se especializa en acabados suaves de calidad de fábrica que modernizan completamente su cocina. Nos tomamos el tiempo para preparar adecuadamente cada superficie (quitando puertas, lijando, imprimando y aplicando varias capas) para que el producto terminado se vea y se sienta como gabinetes nuevos."}
              highlights={language === "en" ? [
                "Smooth, brush-mark-free finish that rivals factory quality",
                "Doors and hardware removed for off-site or on-site refinishing",
                "Color consulting to help you choose the perfect shade for your kitchen",
                "Multi-coat application with proper cure time between coats",
              ] : [
                "Acabado suave y sin marcas de brocha que compite con la calidad de fábrica",
                "Puertas y herrajes retirados para reacabado fuera o dentro del sitio",
                "Consultoría de color para ayudarle a elegir el tono perfecto para su cocina",
                "Aplicación de varias capas con el tiempo de curado adecuado entre capas",
              ]}
              process={language === "en" ? "We remove all doors, drawers, and hardware before sanding and degreasing every surface. A bonding primer is applied, followed by two to three coats of durable cabinet-grade paint. Hardware is reinstalled and everything is inspected before we call it done." : "Retiramos todas las puertas, cajones y herrajes antes de lijar y desengrasar cada superficie. Se aplica una imprimación de adherencia, seguida de dos a tres capas de pintura duradera de grado para gabinetes. Se vuelven a instalar los herrajes y se inspecciona todo antes de dar por terminado el trabajo."}
              icon={Layers}
              delay={0.3}
            />
            <ServiceBlock
              anchorId="deck-staining"
              image={serviceDeck}
              imageAlt={language === "en" ? "Covered porch with natural wood stained deck and outdoor furniture" : "Porche cubierto con terraza teñida de madera natural y muebles de exterior"}
              title={t("services.deck")}
              description={language === "en" ? "Charlotte's heat, humidity, and seasonal rain are tough on deck wood. Without proper protection, your deck can fade, splinter, and deteriorate in just a few seasons. Our deck staining and painting service restores the natural beauty of your outdoor space and extends its lifespan by years. Whether you prefer a transparent stain to show off the wood grain or a solid paint for a clean, modern look, we help you choose the right product and color." : "El calor, la humedad y la lluvia estacional de Charlotte son duros para la madera de las terrazas. Sin la protección adecuada, su terraza puede desvanecerse, astillarse y deteriorarse en solo unas pocas temporadas. Nuestro servicio de teñido y pintura de terrazas restaura la belleza natural de su espacio al aire libre y extiende su vida útil por años. Ya sea que prefiera un tinte transparente para mostrar la veta de la madera o una pintura sólida para un aspecto limpio y moderno, lo ayudamos a elegir el producto y el color adecuados."}
              highlights={language === "en" ? [
                "Deep cleaning and sanding to remove old finish, dirt, and mildew",
                "Stain or paint applied evenly in your choice of color and opacity",
                "Weatherproof sealing to guard against moisture, UV damage, and rot",
                "Minor deck repairs including loose boards, popped nails, and rail fixes",
              ] : [
                "Limpieza profunda y lijado para eliminar el acabado viejo, la suciedad y el moho",
                "Tinte o pintura aplicados uniformemente en el color y la opacidad de su elección",
                "Sellado resistente a la intemperie para proteger contra la humedad, los daños por rayos UV y la pudrición",
                "Reparaciones menores de la terraza, incluyendo tablas sueltas, clavos salidos y arreglos de barandillas",
              ]}
              process={language === "en" ? "We start with a thorough power wash and let the wood dry completely. Damaged or loose boards are repaired before sanding. We then apply your chosen stain or paint in even, consistent coats for maximum protection and a great-looking finish." : "Comenzamos con un lavado a presión a fondo y dejamos que la madera se seque por completo. Las tablas dañadas o sueltas se reparan antes de lijar. Luego aplicamos el tinte o la pintura elegida en capas uniformes y consistentes para una protección máxima y un acabado excelente."}
              icon={Sun}
              delay={0.4}
            />
            <ServiceBlock
              anchorId="fence-staining"
              image={serviceFence}
              imageAlt={language === "en" ? "Cedar privacy fence with natural stain and landscaped garden" : "Cerca de privacidad de cedro con tinte natural y jardín paisajístico"}
              title={t("services.fence")}
              description={language === "en" ? "Your fence is one of the first things people see when they approach your property. Charlotte's weather — from summer sun to heavy rain — can leave wood fences looking gray, worn, and neglected. A professional staining or painting job restores the color, protects against moisture and rot, and adds years of life to your fence. Whether you want a natural wood stain or a painted finish to match your home, we deliver clean, even coverage that holds up season after season." : "Su cerca es una de las primeras cosas que la gente ve cuando se acerca a su propiedad. El clima de Charlotte, desde el sol de verano hasta la lluvia intensa, puede dejar las cercas de madera con un aspecto gris, desgastado y descuidado. Un trabajo profesional de teñido o pintura restaura el color, protege contra la humedad y la pudrición, y agrega años de vida a su cerca. Ya sea que desee un tinte de madera natural o un acabado pintado a juego con su hogar, ofrecemos una cobertura limpia y uniforme que resiste temporada tras temporada."}
              highlights={language === "en" ? [
                "Full fence cleaning and prep to remove dirt, mildew, and old finish",
                "Stain or paint applied evenly on both sides for complete protection",
                "Weatherproof sealing to prevent moisture damage, warping, and rot",
                "Minor repairs including loose pickets, leaning posts, and popped nails",
              ] : [
                "Limpieza completa de la cerca y preparación para eliminar la suciedad, el moho y el acabado viejo",
                "Tinte o pintura aplicados uniformemente en ambos lados para una protección completa",
                "Sellado resistente a la intemperie para evitar daños por humedad, deformaciones y pudrición",
                "Reparaciones menores, incluyendo estacas sueltas, postes inclinados y clavos salidos",
              ]}
              process={language === "en" ? "We power wash the entire fence and allow it to dry thoroughly. Any loose pickets or damaged sections are repaired. We then sand and apply your chosen stain or paint in smooth, even coats, making sure every surface is covered and sealed." : "Lavamos a presión toda la cerca y dejamos que se seque por completo. Se reparan las estacas sueltas o las secciones dañadas. Luego lijamos y aplicamos el tinte o la pintura elegida en capas suaves y uniformes, asegurándonos de que cada superficie esté cubierta y sellada."}
              icon={Fence}
              delay={0.5}
            />
            <ServiceBlock
              anchorId="commercial-painting"
              image={serviceCommercial}
              imageAlt={language === "en" ? "Freshly painted commercial retail center with cream stucco" : "Centro comercial minorista recién pintado con estuco crema"}
              title={t("services.commercial")}
              description={language === "en" ? "First impressions matter for your business. Charlotte Painting Pro provides professional commercial painting services for offices, retail spaces, restaurants, and multi-unit properties across the Charlotte area. We work around your schedule to minimize disruption, delivering clean and professional results that reflect the quality of your brand. From a single suite to an entire building, we bring the same attention to detail we're known for in residential work." : "Las primeras impresiones importan para su negocio. Charlotte Painting Pro ofrece servicios profesionales de pintura comercial para oficinas, espacios comerciales, restaurantes y propiedades de unidades múltiples en toda el área de Charlotte. Trabajamos según su horario para minimizar las interrupciones, entregando resultados limpios y profesionales que reflejan la calidad de su marca. Desde una sola suite hasta un edificio entero, aportamos la misma atención al detalle por la que somos conocidos en el trabajo residencial."}
              highlights={language === "en" ? [
                "Interior and exterior painting for offices, retail, and restaurants",
                "Flexible scheduling including evenings and weekends to reduce downtime",
                "Clean, professional results with minimal disruption to your operations",
                "Multi-unit and property management painting programs available",
              ] : [
                "Pintura interior y exterior para oficinas, comercios y restaurantes",
                "Horarios flexibles que incluyen tardes y fines de semana para reducir el tiempo de inactividad",
                "Resultados limpios y profesionales con interrupciones mínimas en sus operaciones",
                "Programas de pintura disponibles para unidades múltiples y administración de propiedades",
              ]}
              process={language === "en" ? "We start with a walkthrough to understand your space, timeline, and budget. Our team works in phases to keep your business running smoothly. We use fast-drying, low-odor commercial paints and leave every area clean and ready for use." : "Comenzamos con un recorrido para comprender su espacio, cronograma y presupuesto. Nuestro equipo trabaja por fases para que su negocio siga funcionando sin problemas. Utilizamos pinturas comerciales de secado rápido y bajo olor, y dejamos cada área limpia y lista para su uso."}
              icon={Building2}
              delay={0.5}
            />
          </div>
          )}
        </div>
      </section>


      <section className="py-16 bg-secondary">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-primary font-semibold text-sm tracking-wider uppercase mb-3">{t("services.ourWork")}</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              {t("services.recentProjects")}
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {galleryImages.map((img, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="rounded-md overflow-hidden shadow-md cursor-pointer"
                onClick={() => setLightboxIndex(i)}
              >
                <img src={img.src} alt={img.alt} className="w-full h-[160px] md:h-[200px] object-cover" loading="lazy" width={1200} height={800} data-testid={`img-gallery-${i}`} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <MapPin size={20} className="text-primary" />
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{t("services.areaTitle")}</h2>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            {t("services.areaDesc")}
          </p>
          <Link href="/contact">
            <Button data-testid="button-cta-services" className="bg-primary text-primary-foreground font-semibold px-8 h-12 text-base">
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
          {lightboxIndex < galleryImages.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 z-10 transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              data-testid="button-lightbox-next"
            >
              <ChevronRight size={32} />
            </button>
          )}
          <img
            src={galleryImages[lightboxIndex].src}
            alt={galleryImages[lightboxIndex].alt}
            className="max-w-full max-h-[90vh] object-contain rounded-md"
            width={1200}
            height={800}
            onClick={(e) => e.stopPropagation()}
            data-testid="img-lightbox"
          />
        </div>
      )}
    </div>
  );
}
