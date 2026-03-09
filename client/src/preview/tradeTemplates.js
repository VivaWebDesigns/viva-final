/**
 * Trade Templates — client/src/preview/tradeTemplates.js
 *
 * Provides content templates for 6 trades. Each template has:
 *   - displayName (EN + ES)
 *   - heroImageUrl  — Unsplash hero image (replaces the painting video in preview)
 *   - aboutImageUrl — Unsplash about/team photo
 *   - galleryImages — 7 images for the why-us / gallery grid
 *   - services      — 6 services (EN + ES) with iconName (lucide-react string), title, description, benefits
 *   - reviews       — 3 reviews per language; {city} is replaced at runtime
 *
 * Priority order at render time:
 *   1. Client overrides (form fields / buildPreviewPayload opts)
 *   2. Local demo images  (client/src/preview/demo-images/<trade>/)
 *   3. Trade template Unsplash values
 *   4. Generic painting defaults (the original demo content)
 *
 * Adding local images: drop PNG/JPG/WebP into demo-images/<trade>/hero|gallery|support/
 * No code changes needed — imageLibrary auto-discovers them via Vite's import.meta.glob.
 *
 * Image format: Unsplash CDN — free to embed, no API key required
 */

import { getHeroImage, getGalleryImages, getSupportImages } from './imageLibrary.js';

// ─── Shared icon names (must match ICON_MAP keys in each tier's Home.tsx) ──────
// painting: PaintBucket | Paintbrush | Layers | Sun | Fence | Building2
// plumbing: Wrench | Droplets | ShowerHead | Home | Zap | AlertTriangle
// roofing:  HardHat | Home | Cloud | Shield | Wrench | Building2
// electrical: Zap | CircuitBoard | Lightbulb | Shield | Wrench | Building2
// landscaping: Leaf | Flower2 | TreePine | Droplets | Sun | Home
// general: Hammer | Home | Wrench | Shield | Building2 | Layers
// hvac: Thermometer | Fan | Wind | Shield | Wrench | Building2

const U = (id, w = 1200, h = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&q=80&auto=format`;

// ─── PAINTING (default — uses local assets when null) ───────────────────────────
const painting = {
  trade: "painting",
  displayName: { en: "Painting", es: "Pintura" },
  tradeNoun:   { en: "painting", es: "pintura" },

  // null → tier Home.tsx falls back to the bundled painting video / local images
  heroImageUrl:  null,
  aboutImageUrl: null,
  galleryImages: null,

  services: {
    en: [
      { iconName: "PaintBucket", title: "Interior Painting",        description: "Flawless finishes for walls, ceilings, and trim.",                               benefits: ["Walls & Ceilings", "Trim & Molding", "Drywall Repair"] },
      { iconName: "Home",        title: "Exterior Painting",        description: "Boost curb appeal and protect your home from the elements.",                     benefits: ["Siding Painting", "Brick Painting", "Pressure Washing"] },
      { iconName: "Layers",      title: "Cabinet Painting",         description: "Transform your kitchen for a fraction of the cost of replacement.",              benefits: ["Factory Finish", "Hardware Updates", "Color Consulting"] },
      { iconName: "Sun",         title: "Deck Staining",            description: "Restore the beauty and protection of your outdoor living space.",                benefits: ["Cleaning & Sanding", "Stain or Paint", "Weatherproof Sealing"] },
      { iconName: "Fence",       title: "Fence Staining",           description: "Extend the life and beauty of your fence with professional staining.",           benefits: ["Wood Prep & Cleaning", "Even Coverage", "Moisture Protection"] },
      { iconName: "Building2",   title: "Commercial Painting",      description: "Professional painting for offices and retail spaces with minimal disruption.",    benefits: ["Offices & Retail", "Flexible Scheduling", "Low-Odor Paints"] },
    ],
    es: [
      { iconName: "PaintBucket", title: "Pintura de Interiores",    description: "Acabados impecables para paredes, techos y molduras.",                          benefits: ["Paredes y Techos", "Molduras", "Reparación de Drywall"] },
      { iconName: "Home",        title: "Pintura de Exteriores",    description: "Mejore la apariencia de su hogar y protéjalo de los elementos.",                 benefits: ["Pintura de Revestimiento", "Pintura de Ladrillo", "Lavado a Presión"] },
      { iconName: "Layers",      title: "Pintura de Gabinetes",     description: "Transforme su cocina por mucho menos que el costo de reemplazar los gabinetes.", benefits: ["Acabado de Fábrica", "Actualización de Herrajes", "Consultoría de Color"] },
      { iconName: "Sun",         title: "Teñido de Terraza",        description: "Restaure la belleza y protección de su terraza exterior.",                       benefits: ["Limpieza y Lijado", "Tinte o Pintura", "Sellado Impermeable"] },
      { iconName: "Fence",       title: "Teñido de Cercas",         description: "Extienda la vida y belleza de su cerca con teñido profesional.",                 benefits: ["Preparación de Madera", "Cobertura Uniforme", "Protección contra Humedad"] },
      { iconName: "Building2",   title: "Pintura Comercial",        description: "Pintura profesional para oficinas y locales con mínima interrupción.",           benefits: ["Oficinas y Comercios", "Horario Flexible", "Pinturas de Bajo Olor"] },
    ],
  },

  reviews: {
    en: () => [
      { name: "Sarah J.",      location: "Local homeowner",  text: "They painted our entire interior in two days and left the place spotless. The lines are perfect!" },
      { name: "Mike & Linda R.", location: "Local homeowner", text: "Hired them for exterior painting and deck staining. The house looks brand new. Very professional." },
      { name: "Elena Rodriguez", location: "Local homeowner", text: "Best quote we received and the quality exceeded our expectations. Highly recommended!" },
    ],
    es: () => [
      { name: "Sarah J.",      location: "Propietaria local",  text: "Pintaron toda nuestra casa en dos días y dejaron todo impecable. ¡Increíble trabajo!" },
      { name: "Miguel y Linda R.", location: "Propietarios",    text: "Contratamos para exteriores y terraza. La casa parece nueva. Muy profesionales." },
      { name: "Elena Rodriguez", location: "Propietaria local", text: "El mejor presupuesto y la calidad superó nuestras expectativas. ¡Muy recomendados!" },
    ],
  },
};

// ─── PLUMBING ────────────────────────────────────────────────────────────────────
const plumbing = {
  trade: "plumbing",
  displayName: { en: "Plumbing",  es: "Plomería" },
  tradeNoun:   { en: "plumbing",  es: "plomería" },

  heroImageUrl:  U("photo-1585771724684-38269d6639fd"),
  aboutImageUrl: U("photo-1607472586893-edb57bdc0e39"),
  galleryImages: [
    { url: U("photo-1484154218962-a197022b5858", 900, 600), alt: "Modern bathroom renovation" },
    { url: U("photo-1595515106969-1ce29566ff1c", 900, 600), alt: "Kitchen sink installation" },
    { url: U("photo-1594938298603-c8148c4b3d80", 900, 600), alt: "Bathroom faucet repair" },
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600),    alt: "Professional pipe work" },
    { url: U("photo-1542621334-a254cf47733d", 900, 600),    alt: "Water heater installation" },
    { url: U("photo-1566385101042-1a0aa0c1268c", 900, 600), alt: "Drain cleaning service" },
    { url: U("photo-1581578731548-c64695cc6952", 900, 600), alt: "Emergency plumbing repair" },
  ],

  services: {
    en: [
      { iconName: "Wrench",        title: "Drain Cleaning",          description: "Keep your drains clear and pipes flowing with professional drain cleaning service.",              benefits: ["Camera Inspection", "Hydro-Jetting", "Root Removal"] },
      { iconName: "Droplets",      title: "Water Heater Service",    description: "Installation, repair, and replacement of tank and tankless water heaters.",                      benefits: ["Same-Day Install", "Tank & Tankless", "10-Year Warranty"] },
      { iconName: "Home",          title: "Leak Detection & Repair", description: "Fast, lasting repairs for dripping faucets, pipes, and fixtures throughout your home.",          benefits: ["Electronic Detection", "Pipe Repair", "Fixture Replacement"] },
      { iconName: "ShowerHead",    title: "Bathroom Plumbing",       description: "Full installation and remodeling of showers, tubs, toilets, and bathroom fixtures.",             benefits: ["Toilet Install", "Shower & Tub", "Fixture Upgrades"] },
      { iconName: "Zap",           title: "Sewer & Main Line",       description: "Camera inspection and trenchless repair of sewer and main water lines.",                         benefits: ["Camera Inspection", "Trenchless Repair", "Line Replacement"] },
      { iconName: "AlertTriangle", title: "24/7 Emergency Service",  description: "Around-the-clock emergency plumbing for burst pipes, floods, and urgent repairs.",               benefits: ["24/7 Response", "Burst Pipes", "Flood Prevention"] },
    ],
    es: [
      { iconName: "Wrench",        title: "Limpieza de Drenajes",    description: "Mantenga sus drenajes libres y tuberías fluyendo con servicio profesional.",                    benefits: ["Inspección con Cámara", "Hidro-Presión", "Eliminación de Raíces"] },
      { iconName: "Droplets",      title: "Calentadores de Agua",    description: "Instalación, reparación y reemplazo de calentadores de agua de tanque y sin tanque.",           benefits: ["Instalación Mismo Día", "Con y Sin Tanque", "Garantía 10 Años"] },
      { iconName: "Home",          title: "Detección de Fugas",      description: "Reparaciones rápidas y duraderas para tuberías, grifos y accesorios en su hogar.",              benefits: ["Detección Electrónica", "Reparación de Tuberías", "Reemplazo"] },
      { iconName: "ShowerHead",    title: "Plomería de Baño",        description: "Instalación y remodelación de regaderas, tinas, inodoros y accesorios de baño.",                benefits: ["Instalación de Inodoro", "Regadera y Tina", "Accesorios"] },
      { iconName: "Zap",           title: "Líneas de Alcantarillado",description: "Inspección con cámara y reparación sin zanja de líneas principales.",                           benefits: ["Inspección con Cámara", "Reparación Sin Zanja", "Reemplazo"] },
      { iconName: "AlertTriangle", title: "Emergencias 24/7",        description: "Servicio de emergencias las 24 horas para tuberías rotas e inundaciones.",                      benefits: ["Respuesta 24/7", "Tuberías Rotas", "Prevención de Inundaciones"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "Carlos M.",     location: city, text: "Called at 7am about a burst pipe, they were there within 90 minutes. Fixed it fast and cleaned up completely. Outstanding!" },
      { name: "Patricia L.",   location: city, text: "Our water heater died on a cold Saturday. They replaced it the same day for a fair price. Very professional team." },
      { name: "David & Ana S.", location: city, text: "Fixed a slow drain that had been a problem for years. Found a root blockage and cleared it completely. Highly recommend!" },
    ],
    es: (city) => [
      { name: "Carlos M.",     location: city, text: "Llamé a las 7am por una tubería rota y llegaron en 90 minutos. Reparación rápida y limpieza perfecta. ¡Excelente servicio!" },
      { name: "Patricia L.",   location: city, text: "Nuestro calentador murió un sábado frío. Lo reemplazaron el mismo día y a buen precio. Equipo muy profesional." },
      { name: "David y Ana S.", location: city, text: "Arreglaron un drenaje lento que llevaba años de problema. Encontraron y eliminaron un bloqueo de raíces. ¡Muy recomendados!" },
    ],
  },
};

// ─── ROOFING ─────────────────────────────────────────────────────────────────────
const roofing = {
  trade: "roofing",
  displayName: { en: "Roofing",  es: "Techado" },
  tradeNoun:   { en: "roofing",  es: "techado" },

  heroImageUrl:  U("photo-1503387762-592deb58ef4e"),
  aboutImageUrl: U("photo-1504307651254-35680f356dfd"),
  galleryImages: [
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600), alt: "New roof installation" },
    { url: U("photo-1503387762-592deb58ef4e", 900, 600), alt: "Roofing crew at work" },
    { url: U("photo-1621905252507-b35492cc74b4", 900, 600), alt: "Storm damage repair" },
    { url: U("photo-1504307651254-35680f356dfd", 900, 600), alt: "Shingle replacement" },
    { url: U("photo-1504307651254-35680f356dfd&sig=2", 900, 600), alt: "Flat roof membrane" },
    { url: U("photo-1558618666-fcd25c85cd64&sig=2", 900, 600),    alt: "Gutter installation" },
    { url: U("photo-1503387762-592deb58ef4e&sig=2", 900, 600),    alt: "Roof inspection" },
  ],

  services: {
    en: [
      { iconName: "HardHat",   title: "Roof Replacement",       description: "Full tear-off and replacement with premium shingles, metals, or flat roofing systems.",   benefits: ["Asphalt Shingles", "Metal Roofing", "Flat/TPO Systems"] },
      { iconName: "Home",      title: "Roof Repair",            description: "Fast, lasting repairs for leaks, storm damage, missing shingles, and flashing.",          benefits: ["Leak Repair", "Storm Damage", "Flashing Repair"] },
      { iconName: "Cloud",     title: "Storm Damage Claims",    description: "We work directly with your insurance company to get your roof covered after a storm.",     benefits: ["Insurance Assistance", "Hail Damage", "Wind Damage"] },
      { iconName: "Shield",    title: "Roof Inspection",        description: "Detailed inspection reports to catch small problems before they become costly repairs.",    benefits: ["Full Photo Report", "Drone Inspection", "Free Estimate"] },
      { iconName: "Wrench",    title: "Gutter Services",        description: "Installation, cleaning, and repair of gutters and downspouts to protect your foundation.", benefits: ["Seamless Gutters", "Gutter Guards", "Downspout Repair"] },
      { iconName: "Building2", title: "Commercial Roofing",     description: "Low-slope and flat roofing solutions for commercial buildings, warehouses, and HOAs.",     benefits: ["TPO & EPDM", "Built-Up Roofing", "Preventive Maintenance"] },
    ],
    es: [
      { iconName: "HardHat",   title: "Reemplazo de Techo",     description: "Remoción completa e instalación de tejas de primera calidad o sistemas de techo plano.",  benefits: ["Tejas de Asfalto", "Techo de Metal", "Sistemas TPO/Plano"] },
      { iconName: "Home",      title: "Reparación de Techo",    description: "Reparaciones rápidas y duraderas para goteras, daños por tormentas y tejas faltantes.",   benefits: ["Reparación de Goteras", "Daños por Tormenta", "Flashing"] },
      { iconName: "Cloud",     title: "Reclamaciones de Seguro",description: "Trabajamos directamente con su aseguradora para cubrir los daños después de una tormenta.",benefits: ["Asistencia con Seguro", "Daño por Granizo", "Daño por Viento"] },
      { iconName: "Shield",    title: "Inspección de Techo",    description: "Informes detallados para detectar problemas pequeños antes de que se vuelvan costosos.",   benefits: ["Informe con Fotos", "Inspección con Drone", "Estimado Gratis"] },
      { iconName: "Wrench",    title: "Servicio de Canaletas",  description: "Instalación, limpieza y reparación de canaletas y bajadas pluviales.",                    benefits: ["Canaletas Sin Costura", "Protectores", "Reparación de Bajadas"] },
      { iconName: "Building2", title: "Techado Comercial",      description: "Soluciones de techo plano para edificios comerciales y bodegas.",                         benefits: ["TPO y EPDM", "Techo Prefabricado", "Mantenimiento Preventivo"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "James T.",     location: city, text: "Had hail damage and didn't know where to start. They handled everything with our insurance and had a new roof on in 2 days. Amazing!" },
      { name: "Rosa & Frank C.", location: city, text: "Got three quotes. These guys were professional, on time, and cleaned up every nail. The new roof looks beautiful." },
      { name: "Mark B.",      location: city, text: "They spotted a leak during inspection that could have been a huge problem. Fixed same day. Honest and dependable." },
    ],
    es: (city) => [
      { name: "James T.",      location: city, text: "Teníamos daño por granizo y no sabíamos por dónde empezar. Manejaron todo con el seguro y pusieron el techo nuevo en 2 días. ¡Increíble!" },
      { name: "Rosa y Frank C.", location: city, text: "Pedimos tres cotizaciones. Estos fueron los más profesionales, puntuales y limpiaron todo. El techo nuevo quedó hermoso." },
      { name: "Mark B.",       location: city, text: "Detectaron una fuga durante la inspección que pudo haber sido un gran problema. La repararon el mismo día. Honestos y confiables." },
    ],
  },
};

// ─── ELECTRICIAN ─────────────────────────────────────────────────────────────────
const electrician = {
  trade: "electrician",
  displayName: { en: "Electrical",  es: "Electricidad" },
  tradeNoun:   { en: "electrical",  es: "electricidad" },

  heroImageUrl:  U("photo-1621905252507-b35492cc74b4"),
  aboutImageUrl: U("photo-1607990283143-e81e7a2c9349"),
  galleryImages: [
    { url: U("photo-1621905252507-b35492cc74b4", 900, 600), alt: "Electrician panel work" },
    { url: U("photo-1607990283143-e81e7a2c9349", 900, 600), alt: "Electrical panel upgrade" },
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600),    alt: "Wiring installation" },
    { url: U("photo-1504307651254-35680f356dfd", 900, 600), alt: "Outlet installation" },
    { url: U("photo-1503387762-592deb58ef4e", 900, 600),    alt: "EV charger installation" },
    { url: U("photo-1585771724684-38269d6639fd", 900, 600), alt: "Circuit breaker service" },
    { url: U("photo-1416879595882-3373a0480b5b", 900, 600), alt: "Outdoor lighting" },
  ],

  services: {
    en: [
      { iconName: "Zap",          title: "Panel Upgrades",           description: "Upgrade your electrical panel to meet modern demands safely and up to code.",            benefits: ["200-Amp Service", "Code Compliance", "Safety Inspection"] },
      { iconName: "Lightbulb",    title: "Lighting & Fixtures",      description: "Installation and replacement of lights, ceiling fans, and all types of fixtures.",       benefits: ["LED Retrofits", "Ceiling Fans", "Recessed Lighting"] },
      { iconName: "CircuitBoard", title: "Wiring & Rewiring",        description: "New construction wiring and full or partial rewiring for older homes.",                  benefits: ["New Construction", "Aluminum Wiring", "Knob & Tube Removal"] },
      { iconName: "Home",         title: "Outlets & Switches",       description: "Add, replace, or upgrade outlets, switches, and USB charging stations.",                 benefits: ["GFCI Outlets", "USB Outlets", "Smart Switches"] },
      { iconName: "Shield",       title: "Safety & Surge Protection",description: "Whole-home surge protectors, AFCI breakers, and electrical safety inspections.",        benefits: ["Whole-Home Surge", "AFCI Breakers", "Safety Reports"] },
      { iconName: "Truck",        title: "EV Charger Installation",  description: "Level 2 EV charger installation for your home — fast, safe, and code-compliant.",      benefits: ["Level 2 Chargers", "Any EV Brand", "Permit Included"] },
    ],
    es: [
      { iconName: "Zap",          title: "Actualización de Tablero", description: "Moderniza tu tablero eléctrico para satisfacer las demandas actuales con seguridad.",   benefits: ["Servicio de 200 Amp", "Cumplimiento de Código", "Inspección"] },
      { iconName: "Lightbulb",    title: "Iluminación y Accesorios", description: "Instalación y reemplazo de lámparas, ventiladores y todo tipo de accesorios.",          benefits: ["LED", "Ventiladores de Techo", "Iluminación Empotrada"] },
      { iconName: "CircuitBoard", title: "Cableado y Re-cableado",   description: "Cableado para construcción nueva y re-cableado para hogares antiguos.",                  benefits: ["Nueva Construcción", "Cableado de Aluminio", "Cable Antiguo"] },
      { iconName: "Home",         title: "Enchufes e Interruptores", description: "Instalación, reemplazo y actualización de enchufes, interruptores y estaciones USB.",    benefits: ["Enchufes GFCI", "Enchufes USB", "Interruptores Inteligentes"] },
      { iconName: "Shield",       title: "Seguridad Eléctrica",      description: "Protectores de sobretensión, disyuntores AFCI e inspecciones eléctricas.",               benefits: ["Protección Total", "Disyuntores AFCI", "Informes de Seguridad"] },
      { iconName: "Truck",        title: "Instalación de Cargador EV",description: "Instalación de cargador de Nivel 2 para vehículo eléctrico en su hogar.",              benefits: ["Cargadores Nivel 2", "Cualquier Marca EV", "Permiso Incluido"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "Tom & Gail W.", location: city, text: "We needed a full panel upgrade and EV charger installed. They completed both in one day, passed inspection first try. Excellent work!" },
      { name: "Nadia K.",      location: city, text: "Moved into an older home with knob-and-tube wiring. They rewired the whole house on time and on budget. Very professional." },
      { name: "Luis Reyes",    location: city, text: "Had flickering lights and burning smells — scary stuff. They diagnosed and fixed the issue fast. I feel safe in my home again." },
    ],
    es: (city) => [
      { name: "Tom y Gail W.", location: city, text: "Necesitábamos actualizar el tablero e instalar un cargador EV. Completaron ambos en un día y pasaron la inspección al primer intento. ¡Excelente!" },
      { name: "Nadia K.",      location: city, text: "Me mudé a una casa antigua con cableado viejo. Recablearon toda la casa a tiempo y dentro del presupuesto. Muy profesionales." },
      { name: "Luis Reyes",    location: city, text: "Tenía luces parpadeantes y olores a quemado. Diagnosticaron y arreglaron el problema rápido. Me siento seguro en mi hogar." },
    ],
  },
};

// ─── LANDSCAPING ─────────────────────────────────────────────────────────────────
const landscaping = {
  trade: "landscaping",
  displayName: { en: "Landscaping",  es: "Jardinería" },
  tradeNoun:   { en: "landscaping",  es: "jardinería" },

  heroImageUrl:  U("photo-1416879595882-3373a0480b5b"),
  aboutImageUrl: U("photo-1585938389612-a552a28d6914"),
  galleryImages: [
    { url: U("photo-1416879595882-3373a0480b5b", 900, 600), alt: "Beautiful landscaping" },
    { url: U("photo-1585938389612-a552a28d6914", 900, 600), alt: "Garden design" },
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600),    alt: "Lawn maintenance" },
    { url: U("photo-1504307651254-35680f356dfd", 900, 600), alt: "Patio installation" },
    { url: U("photo-1503387762-592deb58ef4e", 900, 600),    alt: "Retaining wall" },
    { url: U("photo-1621905252507-b35492cc74b4", 900, 600), alt: "Sod installation" },
    { url: U("photo-1585771724684-38269d6639fd", 900, 600), alt: "Tree trimming" },
  ],

  services: {
    en: [
      { iconName: "Leaf",      title: "Lawn Maintenance",       description: "Weekly and bi-weekly lawn care including mowing, edging, and blowing.",                  benefits: ["Mowing & Edging", "Fertilization", "Weed Control"] },
      { iconName: "Flower2",   title: "Garden Design",          description: "Custom garden bed design and planting with seasonal color that impresses all year long.",  benefits: ["Custom Design", "Seasonal Plants", "Mulch & Soil"] },
      { iconName: "TreePine",  title: "Tree & Shrub Care",      description: "Pruning, trimming, and shaping of trees and shrubs to keep your yard looking its best.", benefits: ["Tree Trimming", "Shrub Shaping", "Deadwood Removal"] },
      { iconName: "Droplets",  title: "Irrigation Systems",     description: "Installation and repair of smart drip and sprinkler systems for efficient water use.",    benefits: ["Smart Controllers", "Drip Irrigation", "Sprinkler Repair"] },
      { iconName: "Sun",       title: "Hardscaping",            description: "Patios, walkways, retaining walls, and outdoor living spaces built to last.",            benefits: ["Paver Patios", "Retaining Walls", "Walkways"] },
      { iconName: "Home",      title: "Landscape Lighting",     description: "Low-voltage outdoor lighting to enhance beauty and security around your property.",       benefits: ["Path Lighting", "Accent Lights", "Timer Controls"] },
    ],
    es: [
      { iconName: "Leaf",      title: "Mantenimiento de Césped",description: "Servicio semanal o quincenal que incluye corte, bordeado y soplado.",                    benefits: ["Corte y Bordeado", "Fertilización", "Control de Maleza"] },
      { iconName: "Flower2",   title: "Diseño de Jardines",     description: "Diseño personalizado de jardines con plantas de temporada que impresionan todo el año.", benefits: ["Diseño Personalizado", "Plantas de Temporada", "Mantillo y Tierra"] },
      { iconName: "TreePine",  title: "Cuidado de Árboles",     description: "Poda y forma de árboles y arbustos para mantener su jardín en óptimas condiciones.",     benefits: ["Poda de Árboles", "Forma de Arbustos", "Eliminación de Ramas"] },
      { iconName: "Droplets",  title: "Sistemas de Riego",      description: "Instalación y reparación de sistemas de riego inteligentes para uso eficiente del agua.", benefits: ["Controladores Inteligentes", "Riego por Goteo", "Reparación"] },
      { iconName: "Sun",       title: "Paisajismo Duro",        description: "Patios, caminos, muros de contención y espacios exteriores construidos para durar.",      benefits: ["Patios de Adoquín", "Muros de Contención", "Caminos"] },
      { iconName: "Home",      title: "Iluminación Exterior",   description: "Iluminación de bajo voltaje para mejorar la belleza y seguridad de su propiedad.",        benefits: ["Luces de Camino", "Luces de Acento", "Controles de Tiempo"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "Sandra G.",   location: city, text: "They redesigned our front yard from scratch. It went from plain grass to a stunning garden. We get compliments from neighbors every week!" },
      { name: "Robert H.",   location: city, text: "Reliable, professional, and affordable weekly maintenance. Our lawn has never looked better. Best landscaper in the area." },
      { name: "Maria & Joe P.", location: city, text: "Had them install a paver patio and garden beds. The transformation is unbelievable. They finished on schedule and everything was perfect." },
    ],
    es: (city) => [
      { name: "Sandra G.",   location: city, text: "Rediseñaron nuestro jardín delantero desde cero. Pasó de pasto simple a un jardín espectacular. ¡Recibimos cumplidos de vecinos cada semana!" },
      { name: "Roberto H.",  location: city, text: "Mantenimiento semanal confiable, profesional y económico. Nuestro césped nunca ha lucido mejor. El mejor jardinero del área." },
      { name: "María y Joe P.", location: city, text: "Instalaron un patio de adoquines y jardines. La transformación es increíble. Terminaron a tiempo y todo quedó perfecto." },
    ],
  },
};

// ─── HVAC ────────────────────────────────────────────────────────────────────────
const hvac = {
  trade: "hvac",
  displayName: { en: "HVAC",  es: "Climatización" },
  tradeNoun:   { en: "HVAC",  es: "climatización" },

  heroImageUrl:  U("photo-1631545804789-2285c01d2986"),
  aboutImageUrl: U("photo-1558591710-4b4a1ae0f664"),
  galleryImages: [
    { url: U("photo-1631545804789-2285c01d2986", 900, 600), alt: "HVAC unit installation" },
    { url: U("photo-1558591710-4b4a1ae0f664", 900, 600),    alt: "HVAC technician at work" },
    { url: U("photo-1621905252507-b35492cc74b4", 900, 600), alt: "Ductwork installation" },
    { url: U("photo-1585771724684-38269d6639fd", 900, 600), alt: "Thermostat installation" },
    { url: U("photo-1416879595882-3373a0480b5b", 900, 600), alt: "Outdoor AC unit" },
    { url: U("photo-1504307651254-35680f356dfd", 900, 600), alt: "Air handler service" },
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600),    alt: "Maintenance check" },
  ],

  services: {
    en: [
      { iconName: "Thermometer", title: "AC Installation & Replace", description: "Energy-efficient central air and ductless mini-split systems sized for your home.",      benefits: ["Central AC", "Mini-Split", "Energy Star Rated"] },
      { iconName: "Fan",         title: "Heating Installation",      description: "Gas, electric, and heat pump installation for reliable winter comfort.",                benefits: ["Gas Furnaces", "Heat Pumps", "Radiant Heat"] },
      { iconName: "Wind",        title: "AC & Furnace Repair",       description: "Fast diagnosis and repair of all major HVAC brands — often same day.",                  benefits: ["All Major Brands", "Same-Day Repair", "Flat-Rate Pricing"] },
      { iconName: "Shield",      title: "Maintenance Plans",         description: "Bi-annual tune-ups to keep your system running efficiently and prevent costly breakdowns.", benefits: ["Bi-Annual Tune-Up", "Priority Service", "Parts Discounts"] },
      { iconName: "Wrench",      title: "Ductwork Services",         description: "Duct cleaning, sealing, and replacement for better air quality and efficiency.",         benefits: ["Duct Cleaning", "Duct Sealing", "New Ductwork"] },
      { iconName: "Building2",   title: "Commercial HVAC",           description: "Rooftop units, VAV systems, and preventive maintenance for commercial properties.",     benefits: ["Rooftop Units", "VAV Systems", "Service Contracts"] },
    ],
    es: [
      { iconName: "Thermometer", title: "Instalación de Aire Acond.", description: "Sistemas de aire central y mini-split de alta eficiencia adaptados a su hogar.",     benefits: ["Aire Central", "Mini-Split", "Certificado Energy Star"] },
      { iconName: "Fan",         title: "Instalación de Calefacción",description: "Instalación de gas, eléctrica y bomba de calor para un invierno cómodo.",             benefits: ["Hornos de Gas", "Bombas de Calor", "Calor Radiante"] },
      { iconName: "Wind",        title: "Reparación de Equipos",     description: "Diagnóstico y reparación rápida de todas las marcas de HVAC, generalmente el mismo día.", benefits: ["Todas las Marcas", "Reparación Mismo Día", "Precio Fijo"] },
      { iconName: "Shield",      title: "Planes de Mantenimiento",   description: "Revisiones bianuales para mantener su sistema funcionando eficientemente.",             benefits: ["Revisión Bianual", "Servicio Prioritario", "Descuentos"] },
      { iconName: "Wrench",      title: "Ductos y Ventilación",      description: "Limpieza, sellado y reemplazo de conductos para mejor calidad del aire.",               benefits: ["Limpieza de Ductos", "Sellado", "Ductos Nuevos"] },
      { iconName: "Building2",   title: "HVAC Comercial",            description: "Unidades de techo, sistemas VAV y mantenimiento preventivo para propiedades comerciales.", benefits: ["Unidades de Techo", "Sistemas VAV", "Contratos de Servicio"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "Tony & Maria F.", location: city, text: "Our AC died in July. They had us a new unit installed the next day. The house was cool again before dinner. Absolutely incredible service!" },
      { name: "Gregory S.",      location: city, text: "Signed up for their maintenance plan two years ago. Never had a breakdown since. Worth every penny for peace of mind." },
      { name: "Lupe V.",         location: city, text: "They fixed our furnace on Christmas Eve. Showed up on time, found the problem in 20 minutes, and had us warm again. Heroes!" },
    ],
    es: (city) => [
      { name: "Tony y María F.", location: city, text: "Nuestro aire murió en julio. Instalaron una unidad nueva al día siguiente. La casa estaba fresca antes de la cena. ¡Servicio increíble!" },
      { name: "Gregorio S.",     location: city, text: "Me inscribí en su plan de mantenimiento hace dos años. Nunca he tenido una avería desde entonces. Vale cada centavo." },
      { name: "Lupe V.",         location: city, text: "Arreglaron nuestro calefactor en Nochebuena. Llegaron a tiempo, encontraron el problema en 20 minutos y nos dejaron calientes. ¡Héroes!" },
    ],
  },
};

// ─── GENERAL CONTRACTOR ──────────────────────────────────────────────────────────
const general = {
  trade: "general",
  displayName: { en: "General Contractor",  es: "Contratista General" },
  tradeNoun:   { en: "construction",        es: "construcción" },

  heroImageUrl:  U("photo-1504307651254-35680f356dfd"),
  aboutImageUrl: U("photo-1503387762-592deb58ef4e"),
  galleryImages: [
    { url: U("photo-1504307651254-35680f356dfd", 900, 600), alt: "Home renovation" },
    { url: U("photo-1503387762-592deb58ef4e", 900, 600),    alt: "Kitchen remodel" },
    { url: U("photo-1484154218962-a197022b5858", 900, 600), alt: "Bathroom addition" },
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600),    alt: "Room addition" },
    { url: U("photo-1621905252507-b35492cc74b4", 900, 600), alt: "Flooring installation" },
    { url: U("photo-1585771724684-38269d6639fd", 900, 600), alt: "Deck construction" },
    { url: U("photo-1416879595882-3373a0480b5b", 900, 600), alt: "Outdoor project" },
  ],

  services: {
    en: [
      { iconName: "Hammer",    title: "Kitchen Remodeling",     description: "Complete kitchen transformations — from layout changes to custom cabinets and countertops.",  benefits: ["Custom Cabinets", "Countertop Install", "Full Layout Changes"] },
      { iconName: "Home",      title: "Bathroom Renovation",    description: "Full bathroom remodels including tile, fixtures, vanities, and custom showers.",             benefits: ["Tile Work", "Custom Showers", "Vanity & Fixtures"] },
      { iconName: "Layers",    title: "Flooring",               description: "Installation of hardwood, LVP, tile, and carpet throughout your home.",                     benefits: ["Hardwood", "LVP / Vinyl", "Tile & Carpet"] },
      { iconName: "Building2", title: "Room Additions",         description: "Permitted room additions, sunrooms, and garage conversions to expand your living space.",    benefits: ["Full Permits", "Garage Conversions", "Sunrooms"] },
      { iconName: "Wrench",    title: "Decks & Outdoor Spaces", description: "Custom decks, pergolas, and outdoor living spaces built to last and built to code.",         benefits: ["Composite & Wood", "Pergolas", "Outdoor Kitchens"] },
      { iconName: "Shield",    title: "Handyman & Repairs",     description: "Reliable repair and handyman services to handle the projects you keep putting off.",         benefits: ["Drywall Repair", "Door & Window", "Carpentry"] },
    ],
    es: [
      { iconName: "Hammer",    title: "Remodelación de Cocina", description: "Transformaciones completas de cocina — desde distribución hasta gabinetes y encimeras.",    benefits: ["Gabinetes Personalizados", "Encimeras", "Cambio de Distribución"] },
      { iconName: "Home",      title: "Renovación de Baño",     description: "Remodelaciones completas de baño con azulejos, accesorios y regaderas personalizadas.",     benefits: ["Azulejos", "Regaderas Custom", "Tocadores y Accesorios"] },
      { iconName: "Layers",    title: "Pisos",                  description: "Instalación de madera, LVP, azulejo y alfombra en todo su hogar.",                         benefits: ["Madera", "LVP / Vinil", "Azulejo y Alfombra"] },
      { iconName: "Building2", title: "Ampliaciones",           description: "Ampliaciones de habitaciones con permisos, salas de sol y conversiones de garaje.",         benefits: ["Permisos Completos", "Conversión de Garaje", "Salas de Sol"] },
      { iconName: "Wrench",    title: "Terrazas y Exteriores",  description: "Terrazas personalizadas, pérgolas y espacios exteriores construidos para durar.",           benefits: ["Compuesto y Madera", "Pérgolas", "Cocinas Exteriores"] },
      { iconName: "Shield",    title: "Mantenimiento General",  description: "Servicios confiables de reparación y mantenimiento general para su hogar.",                  benefits: ["Reparación de Drywall", "Puertas y Ventanas", "Carpintería"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "Kevin & Diane L.", location: city, text: "They remodeled our kitchen and two bathrooms. Every detail was perfect. Finished 2 days early and under budget. Couldn't be happier!" },
      { name: "Yvonne M.",        location: city, text: "Added a sunroom to our home. They handled all the permits and built it exactly as designed. Our favorite room in the house now." },
      { name: "Rafael C.",        location: city, text: "Reliable handyman service that actually shows up! Fixed our drywall, replaced doors, and installed new flooring in one week. Great value." },
    ],
    es: (city) => [
      { name: "Kevin y Diane L.", location: city, text: "Remodelaron nuestra cocina y dos baños. Cada detalle fue perfecto. Terminaron 2 días antes y por debajo del presupuesto. ¡Felicísimos!" },
      { name: "Yvonne M.",        location: city, text: "Agregaron una sala de sol a nuestra casa. Manejaron todos los permisos y la construyeron exactamente como fue diseñada. ¡Nuestro cuarto favorito!" },
      { name: "Rafael C.",        location: city, text: "¡Servicio de mantenimiento confiable que de verdad llega! Repararon drywall, reemplazaron puertas e instalaron pisos en una semana. Excelente valor." },
    ],
  },
};

// ─── HOUSE CLEANER ───────────────────────────────────────────────────────────────
const housecleaner = {
  trade: "housecleaner",
  displayName: { en: "House Cleaning",  es: "Limpieza de Hogar" },
  tradeNoun:   { en: "cleaning",        es: "limpieza" },

  heroImageUrl:  U("photo-1527515637462-cff94ead201a"),
  aboutImageUrl: U("photo-1584622650111-993a426fbf0a"),
  galleryImages: [
    { url: U("photo-1527515637462-cff94ead201a", 900, 600), alt: "Professional house cleaning" },
    { url: U("photo-1563453392212-326f5e854473", 900, 600), alt: "Maid service at work" },
    { url: U("photo-1584622650111-993a426fbf0a", 900, 600), alt: "Deep cleaning kitchen" },
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600),    alt: "Bathroom cleaning" },
    { url: U("photo-1581578731548-c64695cc6952", 900, 600), alt: "Move-out clean" },
    { url: U("photo-1416879595882-3373a0480b5b", 900, 600), alt: "Post-construction cleanup" },
    { url: U("photo-1585938389612-a552a28d6914", 900, 600), alt: "Eco-friendly cleaning supplies" },
  ],

  services: {
    en: [
      { iconName: "Home",     title: "Regular Cleaning",         description: "Weekly, bi-weekly, or monthly recurring cleaning that keeps your home spotless.",         benefits: ["All Rooms", "Flexible Schedule", "Consistent Team"] },
      { iconName: "Droplets", title: "Deep Cleaning",            description: "A thorough top-to-bottom clean for homes that need extra attention — ideal for first-time service.", benefits: ["Baseboards & Vents", "Inside Appliances", "Full Bathrooms"] },
      { iconName: "Wrench",   title: "Move-In / Move-Out Clean", description: "Detailed cleaning to hand off or receive a property in perfect condition.",                benefits: ["Inside Cabinets", "Walls & Switches", "Full Kitchen"] },
      { iconName: "Shield",   title: "Post-Construction Clean",  description: "Remove dust, debris, and residue after remodels or new construction.",                      benefits: ["Dust Removal", "Window Sills", "Final Inspection Ready"] },
      { iconName: "Leaf",     title: "Eco-Friendly Cleaning",    description: "Green cleaning products that are safe for kids, pets, and the environment.",                 benefits: ["Non-Toxic Products", "Allergen-Free", "EPA-Certified"] },
      { iconName: "Building2",title: "Commercial Cleaning",      description: "Reliable office and commercial space cleaning — before or after business hours.",            benefits: ["Office Spaces", "After-Hours Service", "Custom Schedule"] },
    ],
    es: [
      { iconName: "Home",     title: "Limpieza Regular",         description: "Limpieza recurrente semanal, quincenal o mensual para mantener su hogar impecable.",         benefits: ["Todas las Habitaciones", "Horario Flexible", "Equipo Fijo"] },
      { iconName: "Droplets", title: "Limpieza Profunda",        description: "Una limpieza exhaustiva de arriba a abajo — ideal para la primera vez.",                     benefits: ["Molduras y Ventilaciones", "Dentro de Electrodomésticos", "Baños Completos"] },
      { iconName: "Wrench",   title: "Limpieza de Mudanza",      description: "Limpieza detallada para entregar o recibir una propiedad en perfectas condiciones.",          benefits: ["Dentro de Gabinetes", "Paredes e Interruptores", "Cocina Completa"] },
      { iconName: "Shield",   title: "Limpieza Post-Construcción",description: "Eliminación de polvo, escombros y residuos tras remodelaciones o construcciones.",           benefits: ["Eliminación de Polvo", "Marcos de Ventanas", "Listo para Inspección"] },
      { iconName: "Leaf",     title: "Limpieza Ecológica",       description: "Productos de limpieza verdes y seguros para niños, mascotas y el medio ambiente.",           benefits: ["Productos No Tóxicos", "Sin Alérgenos", "Certificación EPA"] },
      { iconName: "Building2",title: "Limpieza Comercial",       description: "Limpieza confiable de oficinas y espacios comerciales antes o después del horario laboral.",   benefits: ["Oficinas", "Servicio Nocturno", "Horario Personalizado"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "Jennifer A.",   location: city, text: "Our house has never been this clean. They arrived on time, brought all their own supplies, and left everything sparkling. I rebooked immediately!" },
      { name: "Marcus & Sue T.", location: city, text: "Used them for a move-out clean. The landlord was impressed and we got our full deposit back. Worth every penny." },
      { name: "Claudia R.",    location: city, text: "The deep clean was amazing. Got into corners I'd forgotten existed. So thorough and professional. They are our go-to cleaners now." },
    ],
    es: (city) => [
      { name: "Jennifer A.",   location: city, text: "Nuestra casa nunca había estado tan limpia. Llegaron a tiempo, trajeron sus propios materiales y lo dejaron todo brillando. ¡Repetí de inmediato!" },
      { name: "Marcos y Sue T.", location: city, text: "Los contratamos para una limpieza de mudanza. El dueño quedó impresionado y recuperamos el depósito completo. Valió cada centavo." },
      { name: "Claudia R.",    location: city, text: "La limpieza profunda fue increíble. Llegaron a rincones que había olvidado. Tan minuciosos y profesionales. Ya son nuestra empresa de limpieza fija." },
    ],
  },
};

// ─── PRESSURE WASHING ────────────────────────────────────────────────────────────
const pressurewashing = {
  trade: "pressurewashing",
  displayName: { en: "Pressure Washing",  es: "Lavado a Presión" },
  tradeNoun:   { en: "pressure washing",  es: "lavado a presión" },

  heroImageUrl:  U("photo-1558618666-fcd25c85cd64"),
  aboutImageUrl: U("photo-1607472586893-edb57bdc0e39"),
  galleryImages: [
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600), alt: "House soft wash" },
    { url: U("photo-1504307651254-35680f356dfd", 900, 600), alt: "Driveway cleaning" },
    { url: U("photo-1503387762-592deb58ef4e", 900, 600),    alt: "Deck washing" },
    { url: U("photo-1585771724684-38269d6639fd", 900, 600), alt: "Sidewalk pressure washing" },
    { url: U("photo-1484154218962-a197022b5858", 900, 600), alt: "Roof soft wash" },
    { url: U("photo-1621905252507-b35492cc74b4", 900, 600), alt: "Commercial building wash" },
    { url: U("photo-1416879595882-3373a0480b5b", 900, 600), alt: "Patio cleaning" },
  ],

  services: {
    en: [
      { iconName: "Home",      title: "House Washing",            description: "Soft wash exterior cleaning that removes mold, mildew, and grime from siding and brick.",   benefits: ["Soft Wash Method", "All Siding Types", "No Streaks"] },
      { iconName: "Droplets",  title: "Driveway & Sidewalk Clean",description: "Blast away years of oil, grime, and staining from concrete and paver surfaces.",          benefits: ["Oil & Stain Removal", "Pavers & Concrete", "Same-Day Results"] },
      { iconName: "Wrench",    title: "Deck & Fence Washing",     description: "Restore the natural look of wood and composite decks and fences before sealing or staining.", benefits: ["Wood & Composite", "Pre-Stain Prep", "Mold Removal"] },
      { iconName: "Shield",    title: "Roof Soft Wash",           description: "Low-pressure roof cleaning that removes algae, black streaks, and moss safely.",             benefits: ["Safe Low-Pressure", "Algae & Moss", "Roof Warranty Safe"] },
      { iconName: "Building2", title: "Commercial Washing",       description: "Fleet trucks, storefronts, parking lots, and building exteriors — cleaned fast and professionally.", benefits: ["Storefronts", "Parking Lots", "Bulk Pricing"] },
      { iconName: "Sun",       title: "Patio & Pool Deck Clean",  description: "Remove grime and algae from patios, pool decks, and outdoor living areas.",                  benefits: ["Non-Slip Results", "Pool-Safe", "Patio & Pavers"] },
    ],
    es: [
      { iconName: "Home",      title: "Lavado de Casa",           description: "Lavado suave exterior que elimina moho, hongos y suciedad del revestimiento y ladrillo.",    benefits: ["Método Suave", "Todo Tipo de Revestimiento", "Sin Marcas"] },
      { iconName: "Droplets",  title: "Limpieza de Entradas",     description: "Elimina años de aceite, mugre y manchas de superficies de concreto y adoquín.",             benefits: ["Eliminación de Manchas", "Adoquines y Concreto", "Resultados Inmediatos"] },
      { iconName: "Wrench",    title: "Lavado de Terraza y Cerca",description: "Restaura el aspecto natural de terrazas y cercas de madera antes de sellar o teñir.",        benefits: ["Madera y Compuesto", "Prep Pre-Teñido", "Eliminación de Moho"] },
      { iconName: "Shield",    title: "Lavado Suave de Techo",    description: "Limpieza de techo a baja presión que elimina algas, rayas negras y musgo de forma segura.", benefits: ["Baja Presión Segura", "Algas y Musgo", "Sin Daño a Garantía"] },
      { iconName: "Building2", title: "Lavado Comercial",         description: "Camiones, frentes de tienda, estacionamientos y edificios — limpios rápido y profesionalmente.", benefits: ["Frentes de Tienda", "Estacionamientos", "Precios por Volumen"] },
      { iconName: "Sun",       title: "Limpieza de Patios",       description: "Elimina mugre y algas de patios, terrazas de piscina y áreas exteriores.",                   benefits: ["Sin Resbalones", "Seguro para Piscinas", "Patios y Adoquines"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "Brian & Kathy M.", location: city, text: "They washed our driveway and the whole front of the house. It looks brand new. Neighbors keep asking who we hired. Highly recommended!" },
      { name: "Denise O.",     location: city, text: "Roof had terrible black streaks for years. After the soft wash it looks like a new roof. Professional, fast, and fair price." },
      { name: "Kevin T.",      location: city, text: "Had our deck and fence washed before refinishing. They got everything perfectly clean. Prep work was spotless. Will use again." },
    ],
    es: (city) => [
      { name: "Brian y Kathy M.", location: city, text: "Lavaron nuestra entrada y todo el frente de la casa. Se ve como nueva. Los vecinos siguen preguntando a quién contratamos. ¡Muy recomendados!" },
      { name: "Denise O.",     location: city, text: "El techo tenía rayas negras terribles por años. Con el lavado suave parece un techo nuevo. Profesional, rápido y buen precio." },
      { name: "Kevin T.",      location: city, text: "Lavamos la terraza y la cerca antes del acabado. Dejaron todo perfectamente limpio. El trabajo preparatorio fue impecable. Los volvemos a contratar." },
    ],
  },
};

// ─── CARPENTER ───────────────────────────────────────────────────────────────────
const carpenter = {
  trade: "carpenter",
  displayName: { en: "Carpentry",  es: "Carpintería" },
  tradeNoun:   { en: "carpentry",  es: "carpintería" },

  heroImageUrl:  U("photo-1504307651254-35680f356dfd"),
  aboutImageUrl: U("photo-1503387762-592deb58ef4e"),
  galleryImages: [
    { url: U("photo-1504307651254-35680f356dfd", 900, 600), alt: "Custom trim carpentry" },
    { url: U("photo-1503387762-592deb58ef4e", 900, 600),    alt: "Finish carpentry" },
    { url: U("photo-1484154218962-a197022b5858", 900, 600), alt: "Custom cabinetry" },
    { url: U("photo-1621905252507-b35492cc74b4", 900, 600), alt: "Wood framing" },
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600),    alt: "Crown molding installation" },
    { url: U("photo-1585771724684-38269d6639fd", 900, 600), alt: "Built-in shelving" },
    { url: U("photo-1416879595882-3373a0480b5b", 900, 600), alt: "Pergola framing" },
  ],

  services: {
    en: [
      { iconName: "Hammer",    title: "Trim & Molding",           description: "Crown molding, baseboards, chair rail, and decorative trim installed with precision.",        benefits: ["Crown Molding", "Baseboards", "Chair Rail"] },
      { iconName: "Building2", title: "Custom Cabinetry",         description: "Built-in cabinets, closets, and storage solutions designed and built to fit your space.",    benefits: ["Built-Ins", "Custom Closets", "Garage Storage"] },
      { iconName: "Layers",    title: "Finish Carpentry",         description: "High-quality finish work including wainscoting, coffered ceilings, and accent walls.",        benefits: ["Wainscoting", "Coffered Ceilings", "Accent Walls"] },
      { iconName: "Wrench",    title: "Door & Window Casing",     description: "Professional installation and replacement of interior and exterior doors, frames, and casings.", benefits: ["Door Installation", "Window Casings", "Pocket Doors"] },
      { iconName: "Home",      title: "Deck & Patio Framing",     description: "Structural framing for decks, porches, pergolas, and covered outdoor living spaces.",         benefits: ["Deck Framing", "Pergola Build", "Porch Enclosures"] },
      { iconName: "Shield",    title: "Repairs & Restoration",    description: "Expert carpentry repairs for damaged trim, rotted wood, structural framing, and more.",         benefits: ["Rotted Wood", "Structural Repair", "Insurance Claims"] },
    ],
    es: [
      { iconName: "Hammer",    title: "Molduras y Zócalos",       description: "Molduras de corona, zócalos y molduras decorativas instalados con precisión.",               benefits: ["Molduras de Corona", "Zócalos", "Molduras de Silla"] },
      { iconName: "Building2", title: "Gabinetes Personalizados", description: "Gabinetes empotrados, closets y soluciones de almacenamiento diseñados a medida.",           benefits: ["Empotrados", "Closets a Medida", "Almacenamiento de Garaje"] },
      { iconName: "Layers",    title: "Carpintería de Acabado",   description: "Trabajo de acabado de alta calidad: zócalos, techos artesonados y paredes de acento.",        benefits: ["Revestimiento de Pared", "Techos Artesonados", "Paredes de Acento"] },
      { iconName: "Wrench",    title: "Puertas y Marcos",         description: "Instalación y reemplazo profesional de puertas, marcos y molduras interiores y exteriores.",  benefits: ["Instalación de Puertas", "Marcos de Ventanas", "Puertas Corredizas"] },
      { iconName: "Home",      title: "Estructuras Exteriores",   description: "Encuadre estructural para terrazas, porches, pérgolas y espacios exteriores cubiertos.",      benefits: ["Estructura de Terraza", "Pérgola", "Porches Cerrados"] },
      { iconName: "Shield",    title: "Reparaciones de Carpintería",description: "Reparaciones expertas para molduras dañadas, madera podrida y encuadres estructurales.",   benefits: ["Madera Podrida", "Reparación Estructural", "Reclamaciones de Seguro"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "Steve & Anne P.", location: city, text: "Had them install crown molding and built-ins throughout the house. The craftsmanship is outstanding. Every detail was perfect." },
      { name: "Kim L.",         location: city, text: "They built a custom closet system and installed wainscoting in the dining room. It looks like it was always part of the house. Incredible work!" },
      { name: "Doug R.",        location: city, text: "Fixed rotted trim and reframed a door after water damage. Fast, affordable, and the finish work was flawless. Highly recommend." },
    ],
    es: (city) => [
      { name: "Steve y Anne P.", location: city, text: "Instalaron molduras de corona y empotrados en toda la casa. La artesanía es excepcional. Cada detalle fue perfecto." },
      { name: "Kim L.",         location: city, text: "Construyeron un sistema de closet a medida e instalaron revestimiento en el comedor. Parece que siempre estuvo ahí. ¡Trabajo increíble!" },
      { name: "Doug R.",        location: city, text: "Repararon molduras podridas y reencuadraron una puerta dañada por agua. Rápido, económico y el acabado fue impecable. Muy recomendados." },
    ],
  },
};

// ─── FLOOR INSTALLER ─────────────────────────────────────────────────────────────
const floorinstaller = {
  trade: "floorinstaller",
  displayName: { en: "Flooring",  es: "Pisos" },
  tradeNoun:   { en: "flooring",  es: "pisos" },

  heroImageUrl:  U("photo-1572511218469-40f46cc2ec4a"),
  aboutImageUrl: U("photo-1504307651254-35680f356dfd"),
  galleryImages: [
    { url: U("photo-1572511218469-40f46cc2ec4a", 900, 600), alt: "Hardwood floor installation" },
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600),    alt: "LVP flooring install" },
    { url: U("photo-1484154218962-a197022b5858", 900, 600), alt: "Tile floor installation" },
    { url: U("photo-1503387762-592deb58ef4e", 900, 600),    alt: "Carpet installation" },
    { url: U("photo-1621905252507-b35492cc74b4", 900, 600), alt: "Floor sanding and refinishing" },
    { url: U("photo-1585771724684-38269d6639fd", 900, 600), alt: "Commercial flooring" },
    { url: U("photo-1504307651254-35680f356dfd", 900, 600), alt: "Laminate flooring" },
  ],

  services: {
    en: [
      { iconName: "Layers",    title: "Hardwood Flooring",        description: "Solid and engineered hardwood installation that adds timeless beauty and value to your home.", benefits: ["Solid Hardwood", "Engineered Wood", "Custom Staining"] },
      { iconName: "Home",      title: "LVP & Vinyl Plank",        description: "Durable, waterproof luxury vinyl plank — perfect for kitchens, bathrooms, and busy households.", benefits: ["100% Waterproof", "Click-Lock Install", "All Rooms"] },
      { iconName: "Hammer",    title: "Laminate Flooring",        description: "Budget-friendly laminate that mimics hardwood perfectly — fast installation, great results.",   benefits: ["Budget-Friendly", "Fast Install", "Scratch-Resistant"] },
      { iconName: "Wrench",    title: "Floor Sanding & Refinishing",description: "Restore original hardwood floors to like-new condition without full replacement.",           benefits: ["Stain Matching", "Deep Sanding", "New Finish Coat"] },
      { iconName: "Building2", title: "Commercial Flooring",      description: "Epoxy, commercial vinyl tile, and carpet tile for offices, retail, and commercial spaces.",      benefits: ["Epoxy Coating", "Carpet Tile", "Commercial Vinyl"] },
      { iconName: "Shield",    title: "Floor Repair & Subfloor",  description: "Fix squeaky boards, damaged planks, and subfloor issues before or after installation.",          benefits: ["Squeaky Board Fix", "Plank Replacement", "Subfloor Repair"] },
    ],
    es: [
      { iconName: "Layers",    title: "Pisos de Madera",          description: "Instalación de madera sólida e ingeniería que añade belleza y valor a su hogar.",              benefits: ["Madera Sólida", "Madera Ingeniería", "Teñido a Medida"] },
      { iconName: "Home",      title: "Vinil de Lujo (LVP)",      description: "Tablón de vinil de lujo resistente y resistente al agua — perfecto para cocinas y baños.",      benefits: ["100% Impermeable", "Instalación Click", "Todos los Cuartos"] },
      { iconName: "Hammer",    title: "Piso Laminado",            description: "Laminado económico que imita perfectamente la madera — instalación rápida y excelentes resultados.", benefits: ["Económico", "Instalación Rápida", "Resistente a Rayones"] },
      { iconName: "Wrench",    title: "Lijado y Refinado",        description: "Restaure pisos de madera originales a condición de nuevos sin reemplazo completo.",             benefits: ["Igualación de Tinte", "Lijado Profundo", "Capa de Acabado Nueva"] },
      { iconName: "Building2", title: "Pisos Comerciales",        description: "Epoxi, azulejo de vinil comercial y alfombra en baldosas para oficinas y locales.",             benefits: ["Revestimiento Epoxi", "Alfombra en Baldosas", "Vinil Comercial"] },
      { iconName: "Shield",    title: "Reparación de Pisos",      description: "Repare tablas chirriantes, tablones dañados y problemas de subsuelo.",                         benefits: ["Tablas Chirriantes", "Reemplazo de Tablón", "Reparación de Subsuelo"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "Hannah & Craig B.", location: city, text: "They installed LVP throughout the entire first floor. The fit and finish are perfect. No gaps, no lifting. We couldn't be more impressed!" },
      { name: "Tanya M.",         location: city, text: "Had 30-year-old hardwood refinished instead of replaced. It looks incredible — like brand new floors. Saved thousands. So happy!" },
      { name: "James K.",         location: city, text: "Professional install from start to finish. They repaired the subfloor, leveled everything, then installed hardwood. Exceptional craftsmanship." },
    ],
    es: (city) => [
      { name: "Hannah y Craig B.", location: city, text: "Instalaron LVP en todo el primer piso. El acabado es perfecto. Sin espacios, sin levantamiento. ¡No podemos estar más satisfechos!" },
      { name: "Tanya M.",         location: city, text: "Refinamos madera de 30 años en lugar de reemplazarla. Queda increíble, como pisos nuevos. Ahorramos miles. ¡Muy contentos!" },
      { name: "James K.",         location: city, text: "Instalación profesional de principio a fin. Repararon el subsuelo, nivelaron todo y luego instalaron la madera. Artesanía excepcional." },
    ],
  },
};

// ─── TILE INSTALLER ──────────────────────────────────────────────────────────────
const tileinstaller = {
  trade: "tileinstaller",
  displayName: { en: "Tile Installation",  es: "Instalación de Azulejos" },
  tradeNoun:   { en: "tile work",          es: "azulejos" },

  heroImageUrl:  U("photo-1484154218962-a197022b5858"),
  aboutImageUrl: U("photo-1595515106969-1ce29566ff1c"),
  galleryImages: [
    { url: U("photo-1484154218962-a197022b5858", 900, 600), alt: "Shower tile installation" },
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600),    alt: "Kitchen backsplash tile" },
    { url: U("photo-1503387762-592deb58ef4e", 900, 600),    alt: "Floor tile installation" },
    { url: U("photo-1585771724684-38269d6639fd", 900, 600), alt: "Bathroom tile remodel" },
    { url: U("photo-1504307651254-35680f356dfd", 900, 600), alt: "Fireplace tile surround" },
    { url: U("photo-1621905252507-b35492cc74b4", 900, 600), alt: "Outdoor tile patio" },
    { url: U("photo-1416879595882-3373a0480b5b", 900, 600), alt: "Pool tile and coping" },
  ],

  services: {
    en: [
      { iconName: "Droplets",  title: "Shower & Bathroom Tile",  description: "Full shower tile installation — walls, floor, niches, and custom linear drains.",              benefits: ["Custom Showers", "Niche Install", "Linear Drains"] },
      { iconName: "Layers",    title: "Kitchen Backsplash",      description: "Beautiful, on-trend backsplash installation from subway tile to herringbone and beyond.",       benefits: ["Subway & Mosaic", "Grout Matching", "Clean Install"] },
      { iconName: "Home",      title: "Floor Tile Installation", description: "Large-format, porcelain, and natural stone floor tile installed level and square.",              benefits: ["Large Format", "Porcelain & Stone", "Radiant Heat Ready"] },
      { iconName: "Hammer",    title: "Fireplace Surrounds",     description: "Custom tile or stone surrounds that transform any fireplace into a stunning focal point.",        benefits: ["Custom Design", "Natural Stone", "Mantel Integration"] },
      { iconName: "Building2", title: "Commercial Tile",         description: "High-traffic porcelain, quarry tile, and epoxy grout for commercial kitchens, restaurants, and retail.", benefits: ["Commercial Grade", "Epoxy Grout", "Health Code Ready"] },
      { iconName: "Shield",    title: "Grout Repair & Sealing",  description: "Restore stained or cracked grout lines and seal tile surfaces to prevent future damage.",        benefits: ["Grout Recolor", "Crack Repair", "Waterproof Sealing"] },
    ],
    es: [
      { iconName: "Droplets",  title: "Azulejos de Baño y Ducha",description: "Instalación completa de azulejos en duchas — paredes, piso, nichos y desagües lineales.",       benefits: ["Duchas Personalizadas", "Nichos", "Desagüe Lineal"] },
      { iconName: "Layers",    title: "Salpicaderos de Cocina",  description: "Instalación de salpicadero a la moda — desde subway tile hasta patrones de espiga.",             benefits: ["Subway y Mosaico", "Igualación de Lechada", "Instalación Limpia"] },
      { iconName: "Home",      title: "Azulejos de Piso",        description: "Azulejo de gran formato, porcelana y piedra natural instalados nivelados y cuadrados.",          benefits: ["Gran Formato", "Porcelana y Piedra", "Listo para Calor Radiante"] },
      { iconName: "Hammer",    title: "Chimeneas y Remates",     description: "Revestimientos personalizados de azulejo o piedra que transforman cualquier chimenea.",          benefits: ["Diseño a Medida", "Piedra Natural", "Integración de Repisa"] },
      { iconName: "Building2", title: "Azulejos Comerciales",    description: "Porcelana de alto tráfico, azulejo industrial y lechada de epoxi para restaurantes y comercios.", benefits: ["Grado Comercial", "Lechada Epoxi", "Listo para Código de Salud"] },
      { iconName: "Shield",    title: "Reparación y Sellado",    description: "Restaure la lechada manchada o agrietada y selle las superficies de azulejo para prevenir daños.", benefits: ["Recoloración de Lechada", "Reparación de Grietas", "Sellado Impermeable"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "Linda & Paul S.", location: city, text: "They tiled our master shower and the floor. The pattern is flawless — every grout line is perfect. We get compliments every time someone sees it!" },
      { name: "Rachel F.",       location: city, text: "Kitchen backsplash came out exactly as I envisioned. Clean install, no mess left behind, and they were done in one day. Love it!" },
      { name: "Hector G.",       location: city, text: "Had cracked grout and old tile all over the bathrooms. They retiled everything and it looks amazing. Fair price and expert workmanship." },
    ],
    es: (city) => [
      { name: "Linda y Paul S.", location: city, text: "Instalaron azulejos en nuestra ducha principal y el piso. El patrón es perfecto — cada línea de lechada es impecable. ¡Recibimos cumplidos siempre!" },
      { name: "Rachel F.",       location: city, text: "El salpicadero de la cocina quedó exactamente como lo imaginé. Instalación limpia, sin desorden, y lo terminaron en un día. ¡Me encanta!" },
      { name: "Héctor G.",       location: city, text: "Teníamos lechada agrietada y azulejos viejos en todos los baños. Lo renovaron todo y queda increíble. Buen precio y excelente trabajo." },
    ],
  },
};

// ─── FENCE INSTALLER ─────────────────────────────────────────────────────────────
const fenceinstaller = {
  trade: "fenceinstaller",
  displayName: { en: "Fence Installation",  es: "Instalación de Cercas" },
  tradeNoun:   { en: "fence installation",  es: "cercas" },

  heroImageUrl:  U("photo-1558618666-fcd25c85cd64"),
  aboutImageUrl: U("photo-1504307651254-35680f356dfd"),
  galleryImages: [
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600), alt: "Privacy wood fence" },
    { url: U("photo-1503387762-592deb58ef4e", 900, 600), alt: "Aluminum fence install" },
    { url: U("photo-1504307651254-35680f356dfd", 900, 600), alt: "Chain link fence" },
    { url: U("photo-1585771724684-38269d6639fd", 900, 600), alt: "Vinyl privacy fence" },
    { url: U("photo-1416879595882-3373a0480b5b", 900, 600), alt: "Decorative iron fence" },
    { url: U("photo-1621905252507-b35492cc74b4", 900, 600), alt: "Custom gate installation" },
    { url: U("photo-1484154218962-a197022b5858", 900, 600), alt: "Fence repair" },
  ],

  services: {
    en: [
      { iconName: "Fence",     title: "Privacy Wood Fence",       description: "6-foot cedar or pine privacy fences built to your property line with long-lasting hardware.",  benefits: ["Cedar & Pine", "Dog-Ear or Flat Top", "Post-in-Concrete"] },
      { iconName: "Shield",    title: "Aluminum & Iron Fencing",  description: "Low-maintenance aluminum or wrought iron fencing for beautiful, secure property boundaries.", benefits: ["Powder Coated", "Low Maintenance", "Multiple Styles"] },
      { iconName: "Home",      title: "Vinyl & PVC Fencing",      description: "Durable vinyl fencing in privacy, picket, and ranch styles — never needs painting or staining.", benefits: ["No Painting", "Never Rots", "20-Year Warranty"] },
      { iconName: "Wrench",    title: "Chain Link Fencing",       description: "Residential and commercial chain link fencing — affordable, durable, and quick to install.",   benefits: ["Residential & Commercial", "Coated Options", "Fast Install"] },
      { iconName: "Hammer",    title: "Custom Gates",             description: "Custom-built wood, aluminum, or iron gates with manual or automatic openers.",                  benefits: ["Custom Sizing", "Automated Options", "Matching Fence Style"] },
      { iconName: "Building2", title: "Fence Repair & Replacement",description: "Replace broken posts, sagging panels, or damaged sections to restore safety and appearance.",  benefits: ["Post Replacement", "Panel Sections", "Storm Damage"] },
    ],
    es: [
      { iconName: "Fence",     title: "Cerca de Privacidad",      description: "Cercas de privacidad de cedro o pino de 6 pies construidas con herrajes duraderos.",           benefits: ["Cedro y Pino", "Dog-Ear o Plana", "Postes en Concreto"] },
      { iconName: "Shield",    title: "Cercas de Aluminio y Hierro",description: "Cercas de aluminio o hierro forjado de bajo mantenimiento para límites seguros y elegantes.",  benefits: ["Recubrimiento en Polvo", "Bajo Mantenimiento", "Múltiples Estilos"] },
      { iconName: "Home",      title: "Cercas de Vinil y PVC",    description: "Cercas de vinil duraderas en estilos privacidad, estacas y rancho — nunca necesita pintura.",  benefits: ["Sin Pintura", "No Se Pudre", "Garantía de 20 Años"] },
      { iconName: "Wrench",    title: "Cercas de Cadena",         description: "Cercas de cadena residenciales y comerciales — económicas, duraderas y de instalación rápida.", benefits: ["Residencial y Comercial", "Opciones Recubiertas", "Instalación Rápida"] },
      { iconName: "Hammer",    title: "Puertas a Medida",         description: "Puertas a medida de madera, aluminio o hierro con apertura manual o automática.",              benefits: ["Tamaño Personalizado", "Opciones Automáticas", "Estilo Igualado"] },
      { iconName: "Building2", title: "Reparación de Cercas",     description: "Reemplace postes rotos, paneles caídos o secciones dañadas para restaurar seguridad y apariencia.", benefits: ["Reemplazo de Postes", "Secciones de Panel", "Daño por Tormentas"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "Scott & Beth R.", location: city, text: "They built a full cedar privacy fence around our backyard. Posts are solid, panels are perfectly straight. The dogs love it! Great work." },
      { name: "Crystal T.",     location: city, text: "Had them install a custom aluminum fence with a solar gate. It looks beautiful and the auto gate makes life so easy. Worth every dollar." },
      { name: "Nate H.",        location: city, text: "Half our fence was knocked down in a storm. They were out the next day and replaced all the damaged sections. Fast and professional." },
    ],
    es: (city) => [
      { name: "Scott y Beth R.", location: city, text: "Construyeron una cerca de privacidad de cedro completa alrededor del jardín. Postes sólidos, paneles perfectamente rectos. ¡A los perros les encanta! Gran trabajo." },
      { name: "Crystal T.",     location: city, text: "Instalaron una cerca de aluminio a medida con puerta solar. Se ve hermosa y la puerta automática hace la vida muy fácil. Valió cada centavo." },
      { name: "Nate H.",        location: city, text: "La mitad de nuestra cerca cayó en una tormenta. Llegaron al día siguiente y reemplazaron todas las secciones dañadas. Rápido y profesional." },
    ],
  },
};

// ─── DECK BUILDER ────────────────────────────────────────────────────────────────
const deckbuilder = {
  trade: "deckbuilder",
  displayName: { en: "Deck Building",  es: "Construcción de Terrazas" },
  tradeNoun:   { en: "deck building",  es: "terrazas" },

  heroImageUrl:  U("photo-1544967082-d9d25d867d66"),
  aboutImageUrl: U("photo-1576941089067-2de3c901e126"),
  galleryImages: [
    { url: U("photo-1544967082-d9d25d867d66", 900, 600), alt: "Custom wood deck" },
    { url: U("photo-1503387762-592deb58ef4e", 900, 600), alt: "Composite deck installation" },
    { url: U("photo-1585771724684-38269d6639fd", 900, 600), alt: "Pergola and deck combo" },
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600),    alt: "Deck with railing system" },
    { url: U("photo-1504307651254-35680f356dfd", 900, 600), alt: "Multi-level deck" },
    { url: U("photo-1416879595882-3373a0480b5b", 900, 600), alt: "Deck outdoor living" },
    { url: U("photo-1621905252507-b35492cc74b4", 900, 600), alt: "Deck repair and boards" },
  ],

  services: {
    en: [
      { iconName: "Hammer",    title: "Custom Deck Building",     description: "Ground-up deck construction using premium pressure-treated wood, cedar, or composite materials.", benefits: ["Pressure-Treated", "Cedar & Redwood", "Custom Sizing"] },
      { iconName: "Layers",    title: "Composite Decking",        description: "Low-maintenance composite deck boards that resist fading, staining, and scratching for decades.", benefits: ["Trex & Azek", "No Staining", "25-Year Warranty"] },
      { iconName: "Sun",       title: "Pergolas & Shade Structures",description: "Custom pergolas, shade sails, and lattice covers to make your deck a true outdoor retreat.",   benefits: ["Custom Design", "Attached or Freestanding", "Shade & Privacy"] },
      { iconName: "Wrench",    title: "Deck Repair & Restoration",description: "Board replacement, structural repairs, and deck refinishing to extend the life of your deck.",    benefits: ["Board Replacement", "Structural Repair", "Staining & Sealing"] },
      { iconName: "Shield",    title: "Railing Systems",          description: "Cable, glass, aluminum, and wood railing systems that are safe, code-compliant, and beautiful.",    benefits: ["Cable Railing", "Glass Panels", "Aluminum & Wood"] },
      { iconName: "Home",      title: "Outdoor Living Spaces",    description: "Full outdoor kitchens, built-in seating, fire pit areas, and multi-level entertainment decks.",     benefits: ["Outdoor Kitchens", "Built-In Seating", "Fire Pit Area"] },
    ],
    es: [
      { iconName: "Hammer",    title: "Construcción de Terrazas", description: "Construcción de terrazas desde cero usando madera tratada, cedro o materiales compuestos.",     benefits: ["Madera Tratada", "Cedro y Secoya", "Tamaño Personalizado"] },
      { iconName: "Layers",    title: "Terrazas Compuestas",      description: "Tablas de terraza compuestas de bajo mantenimiento que resisten el desvanecimiento y el rayado.", benefits: ["Trex y Azek", "Sin Teñir", "Garantía de 25 Años"] },
      { iconName: "Sun",       title: "Pérgolas y Sombras",       description: "Pérgolas personalizadas y cubiertas de celosía para convertir su terraza en un refugio exterior.", benefits: ["Diseño Personalizado", "Adjunta o Independiente", "Sombra y Privacidad"] },
      { iconName: "Wrench",    title: "Reparación y Restauración",description: "Reemplazo de tablas, reparaciones estructurales y refinado para extender la vida de su terraza.", benefits: ["Reemplazo de Tablas", "Reparación Estructural", "Teñido y Sellado"] },
      { iconName: "Shield",    title: "Sistemas de Barandillas",  description: "Barandillas de cable, vidrio, aluminio y madera — seguras, conformes al código y hermosas.",      benefits: ["Barandilla de Cable", "Paneles de Vidrio", "Aluminio y Madera"] },
      { iconName: "Home",      title: "Espacios de Vida Exterior",description: "Cocinas exteriores completas, asientos empotrados, áreas de fogata y terrazas de entretenimiento.", benefits: ["Cocinas Exteriores", "Asientos Empotrados", "Área de Fogata"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "Josh & Megan A.", location: city, text: "They built a 20x16 composite deck with a pergola. The craftsmanship is incredible. We spend every evening out there now. Best home investment we've made!" },
      { name: "Terry S.",        location: city, text: "Our old deck was rotting. They assessed it and rebuilt it completely with cable railing. It looks stunning and feels rock solid." },
      { name: "Priya N.",        location: city, text: "They added an outdoor kitchen and fire pit area to our existing deck. The project was done on time and on budget. Absolutely love it!" },
    ],
    es: (city) => [
      { name: "Josh y Megan A.", location: city, text: "Construyeron una terraza compuesta de 20x16 con pérgola. La artesanía es increíble. Ahora pasamos cada tarde ahí. ¡La mejor inversión que hemos hecho en casa!" },
      { name: "Terry S.",        location: city, text: "Nuestra vieja terraza se estaba pudriendo. La evaluaron y reconstruyeron completamente con barandilla de cable. Se ve impresionante y se siente sólida." },
      { name: "Priya N.",        location: city, text: "Agregaron una cocina exterior y área de fogata a nuestra terraza existente. El proyecto se terminó a tiempo y dentro del presupuesto. ¡La amamos!" },
    ],
  },
};

// ─── SHED BUILDER ────────────────────────────────────────────────────────────────
const shedbuilder = {
  trade: "shedbuilder",
  displayName: { en: "Shed Building",  es: "Construcción de Cobertizos" },
  tradeNoun:   { en: "shed building",  es: "cobertizos" },

  heroImageUrl:  U("photo-1504307651254-35680f356dfd"),
  aboutImageUrl: U("photo-1503387762-592deb58ef4e"),
  galleryImages: [
    { url: U("photo-1504307651254-35680f356dfd", 900, 600), alt: "Custom backyard shed" },
    { url: U("photo-1503387762-592deb58ef4e", 900, 600),    alt: "Storage shed construction" },
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600),    alt: "Workshop shed" },
    { url: U("photo-1585771724684-38269d6639fd", 900, 600), alt: "She-shed studio" },
    { url: U("photo-1416879595882-3373a0480b5b", 900, 600), alt: "Garden shed" },
    { url: U("photo-1621905252507-b35492cc74b4", 900, 600), alt: "Shed with loft" },
    { url: U("photo-1484154218962-a197022b5858", 900, 600), alt: "Barn-style building" },
  ],

  services: {
    en: [
      { iconName: "Building2", title: "Custom Storage Sheds",     description: "Site-built storage sheds in any size, designed to match your home and maximize your yard.", benefits: ["Any Size", "Matches Home Style", "Permit Ready"] },
      { iconName: "Hammer",    title: "Workshop Sheds",           description: "Heavy-duty workshop buildings with upgraded framing, electrical, and insulation.",             benefits: ["220V Electric", "Insulated Walls", "Reinforced Floor"] },
      { iconName: "Layers",    title: "She-Sheds & Studios",      description: "Custom backyard studio spaces for crafts, yoga, home offices, or quiet retreat.",              benefits: ["Custom Interior", "Windows & Skylights", "HVAC-Ready"] },
      { iconName: "Home",      title: "Barn-Style Buildings",     description: "Classic barn-style sheds and multipurpose outbuildings with loft storage.",                   benefits: ["Loft Option", "Double Doors", "Classic Styling"] },
      { iconName: "Wrench",    title: "Shed Foundation Work",     description: "Gravel pad, concrete, or skid foundation installation to keep your shed level and dry.",        benefits: ["Concrete Pads", "Gravel Base", "Skid Foundation"] },
      { iconName: "Shield",    title: "Shed Repair & Renovation", description: "Repair or upgrade an existing shed — roof, siding, doors, and foundation fixes.",              benefits: ["Roof Repair", "New Siding", "Door Replacement"] },
    ],
    es: [
      { iconName: "Building2", title: "Cobertizos de Almacenaje",  description: "Cobertizos de almacenaje a medida en cualquier tamaño, diseñados para combinar con su hogar.", benefits: ["Cualquier Tamaño", "Estilo a Medida", "Listo para Permiso"] },
      { iconName: "Hammer",    title: "Cobertizos de Taller",      description: "Talleres resistentes con encuadre mejorado, electricidad y aislamiento.",                     benefits: ["Eléctrico 220V", "Paredes Aisladas", "Piso Reforzado"] },
      { iconName: "Layers",    title: "Estudios y Oficinas",       description: "Espacios de estudio en el patio para manualidades, yoga, oficina en casa o retiro privado.",   benefits: ["Interior Personalizado", "Ventanas y Tragaluces", "Listo para HVAC"] },
      { iconName: "Home",      title: "Construcciones Estilo Granero",description: "Cobertizos estilo granero y edificios multiusos con almacenamiento en altillo.",           benefits: ["Opción de Altillo", "Puertas Dobles", "Estilo Clásico"] },
      { iconName: "Wrench",    title: "Trabajo de Cimentación",    description: "Instalación de base de grava, concreto o patín para mantener su cobertizo nivelado y seco.",  benefits: ["Losas de Concreto", "Base de Grava", "Cimentación de Patín"] },
      { iconName: "Shield",    title: "Reparación de Cobertizos",  description: "Repare o mejore un cobertizo existente — techo, revestimiento, puertas y cimientos.",          benefits: ["Reparación de Techo", "Revestimiento Nuevo", "Reemplazo de Puertas"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "Gary & Pam W.",  location: city, text: "They built a 12x20 workshop shed with power. It's exactly what I envisioned — solid construction, great finish, and done in 3 days. Amazing job!" },
      { name: "Irene S.",       location: city, text: "Had them build a she-shed for my art studio. They added windows, a skylight, and electric. It's my favorite place in the world now!" },
      { name: "Barry C.",       location: city, text: "Our old shed was falling apart. They repaired the foundation, replaced the siding and roof. Looks brand new and cost a fraction of a full rebuild." },
    ],
    es: (city) => [
      { name: "Gary y Pam W.",  location: city, text: "Construyeron un cobertizo de taller de 12x20 con electricidad. Es exactamente lo que imaginé — construcción sólida y terminado en 3 días. ¡Trabajo increíble!" },
      { name: "Irene S.",       location: city, text: "Me construyeron un cobertizo para mi estudio de arte. Agregaron ventanas, un tragaluz y electricidad. ¡Ahora es mi lugar favorito del mundo!" },
      { name: "Barry C.",       location: city, text: "Nuestro viejo cobertizo se estaba cayendo. Repararon los cimientos, reemplazaron el revestimiento y el techo. Parece nuevo y costó mucho menos que uno nuevo." },
    ],
  },
};

// ─── CONCRETE / ASPHALT ──────────────────────────────────────────────────────────
const concrete = {
  trade: "concrete",
  displayName: { en: "Concrete & Asphalt",  es: "Concreto y Asfalto" },
  tradeNoun:   { en: "concrete work",       es: "concreto y asfalto" },

  heroImageUrl:  U("photo-1621905252507-b35492cc74b4"),
  aboutImageUrl: U("photo-1504307651254-35680f356dfd"),
  galleryImages: [
    { url: U("photo-1621905252507-b35492cc74b4", 900, 600), alt: "Concrete driveway installation" },
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600),    alt: "Stamped concrete patio" },
    { url: U("photo-1504307651254-35680f356dfd", 900, 600), alt: "Asphalt driveway paving" },
    { url: U("photo-1503387762-592deb58ef4e", 900, 600),    alt: "Concrete sidewalk pour" },
    { url: U("photo-1585771724684-38269d6639fd", 900, 600), alt: "Decorative concrete" },
    { url: U("photo-1416879595882-3373a0480b5b", 900, 600), alt: "Parking lot paving" },
    { url: U("photo-1484154218962-a197022b5858", 900, 600), alt: "Concrete repair patching" },
  ],

  services: {
    en: [
      { iconName: "HardHat",   title: "Concrete Driveways",       description: "New concrete driveway installation built to last — properly formed, reinforced, and finished.", benefits: ["Rebar Reinforced", "Control Joints", "Brushed or Smooth Finish"] },
      { iconName: "Truck",     title: "Asphalt Paving",           description: "Hot-mix asphalt driveways, parking lots, and roads — laid smooth and compacted to spec.",      benefits: ["Hot Mix Asphalt", "Compacted Base", "Edge Trim"] },
      { iconName: "Layers",    title: "Stamped & Decorative Concrete",description: "Beautiful stamped, stained, and exposed aggregate concrete for patios and walkways.",      benefits: ["Stamped Patterns", "Color Staining", "Exposed Aggregate"] },
      { iconName: "Wrench",    title: "Sidewalks & Walkways",     description: "New and replacement concrete sidewalks, pathways, and front walk installation.",                benefits: ["Residential", "Commercial", "ADA Compliant"] },
      { iconName: "Building2", title: "Commercial Paving",        description: "Parking lots, loading docks, and commercial site paving — permitted and code-compliant.",        benefits: ["Parking Lots", "Loading Docks", "Permitted Work"] },
      { iconName: "Shield",    title: "Concrete Repair & Sealing",description: "Crack filling, slab leveling, resurfacing, and sealing to restore existing concrete.",          benefits: ["Crack Repair", "Mudjacking", "Protective Sealing"] },
    ],
    es: [
      { iconName: "HardHat",   title: "Entradas de Concreto",     description: "Instalación de nuevas entradas de concreto — bien formadas, reforzadas y terminadas.",          benefits: ["Refuerzo de Varilla", "Juntas de Control", "Acabado Cepillado"] },
      { iconName: "Truck",     title: "Pavimentación de Asfalto", description: "Entradas, estacionamientos y caminos de asfalto de mezcla caliente — compactados y nivelados.", benefits: ["Asfalto Mezcla Caliente", "Base Compactada", "Bordes Nítidos"] },
      { iconName: "Layers",    title: "Concreto Estampado",       description: "Concreto estampado, teñido y agregado expuesto para patios y andadores.",                       benefits: ["Patrones Estampados", "Teñido de Color", "Agregado Expuesto"] },
      { iconName: "Wrench",    title: "Banquetas y Andadores",    description: "Instalación de nuevas banquetas y andadores de concreto, residenciales y comerciales.",          benefits: ["Residencial", "Comercial", "Cumple con ADA"] },
      { iconName: "Building2", title: "Pavimentación Comercial",  description: "Estacionamientos, muelles de carga y pavimentación de sitios comerciales con permisos.",        benefits: ["Estacionamientos", "Muelles de Carga", "Trabajo con Permisos"] },
      { iconName: "Shield",    title: "Reparación y Sellado",     description: "Relleno de grietas, nivelación de losas, resurfacing y sellado para restaurar el concreto.",    benefits: ["Reparación de Grietas", "Nivelación", "Sellado Protector"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "Frank & Donna M.", location: city, text: "They replaced our crumbling driveway with beautiful stamped concrete. It transformed the whole look of the house. Crew was professional and fast." },
      { name: "Victor P.",        location: city, text: "Had them pave our business parking lot. The base was done right, drainage is great, and the asphalt is smooth and thick. No complaints whatsoever!" },
      { name: "Linda T.",         location: city, text: "Our sidewalks were cracked and uneven. They mudjacked the bad sections and sealed everything. Done in a day and looks great. Will definitely call again." },
    ],
    es: (city) => [
      { name: "Frank y Donna M.", location: city, text: "Reemplazaron nuestra entrada desmoronada con hermoso concreto estampado. Transformó el aspecto de toda la casa. El equipo fue profesional y rápido." },
      { name: "Víctor P.",        location: city, text: "Pavimentaron el estacionamiento de nuestro negocio. La base se hizo bien, el drenaje es excelente y el asfalto es suave y grueso. ¡Sin quejas!" },
      { name: "Linda T.",         location: city, text: "Nuestras banquetas estaban agrietadas y disparejas. Nivelaron las secciones malas y sellaron todo. Terminaron en un día y queda genial. Definitivamente los llamaré de nuevo." },
    ],
  },
};

// ─── TREE SERVICE ────────────────────────────────────────────────────────────────
const treeservice = {
  trade: "treeservice",
  displayName: { en: "Tree Service",  es: "Servicio de Árboles" },
  tradeNoun:   { en: "tree service",  es: "árboles" },

  heroImageUrl:  U("photo-1416879595882-3373a0480b5b"),
  aboutImageUrl: U("photo-1585938389612-a552a28d6914"),
  galleryImages: [
    { url: U("photo-1416879595882-3373a0480b5b", 900, 600), alt: "Tree removal service" },
    { url: U("photo-1585938389612-a552a28d6914", 900, 600), alt: "Tree trimming crew" },
    { url: U("photo-1503387762-592deb58ef4e", 900, 600),    alt: "Stump grinding" },
    { url: U("photo-1504307651254-35680f356dfd", 900, 600), alt: "Storm cleanup" },
    { url: U("photo-1558618666-fcd25c85cd64", 900, 600),    alt: "Lot clearing" },
    { url: U("photo-1585771724684-38269d6639fd", 900, 600), alt: "Tree health assessment" },
    { url: U("photo-1621905252507-b35492cc74b4", 900, 600), alt: "Large tree removal" },
  ],

  services: {
    en: [
      { iconName: "TreePine",  title: "Tree Removal",             description: "Safe, controlled removal of hazardous, dead, or unwanted trees of any size.",                  benefits: ["Any Size Tree", "Safe Rigging", "Full Cleanup"] },
      { iconName: "Leaf",      title: "Tree Trimming & Pruning",  description: "Professional crown thinning, deadwood removal, and structural pruning to keep trees healthy.", benefits: ["Crown Thinning", "Deadwood Removal", "Shape & Clearance"] },
      { iconName: "Hammer",    title: "Stump Grinding",           description: "Complete stump removal below grade so you can reclaim your lawn, plant, or build.",            benefits: ["Below Grade Grind", "Debris Removal", "Replanting Ready"] },
      { iconName: "Truck",     title: "Emergency Storm Cleanup",  description: "24/7 emergency response for fallen trees, broken limbs, and storm-damaged property.",          benefits: ["24/7 Response", "Fallen Trees", "Property Protection"] },
      { iconName: "Shield",    title: "Tree Health Assessment",   description: "Certified arborist inspections to diagnose disease, pest infestations, and structural issues.", benefits: ["ISA Certified", "Disease Diagnosis", "Treatment Plan"] },
      { iconName: "Building2", title: "Lot Clearing",             description: "Full residential and commercial lot clearing for construction, development, or land clean-up.", benefits: ["Full Lot Clearing", "Brush Removal", "Site Prep"] },
    ],
    es: [
      { iconName: "TreePine",  title: "Tala de Árboles",          description: "Remoción segura y controlada de árboles peligrosos, muertos o no deseados de cualquier tamaño.", benefits: ["Árbol de Cualquier Tamaño", "Aparejamiento Seguro", "Limpieza Completa"] },
      { iconName: "Leaf",      title: "Poda de Árboles",          description: "Adelgazado de copa profesional, remoción de madera muerta y poda estructural.",                benefits: ["Adelgazado de Copa", "Remoción de Madera Muerta", "Forma y Espacio"] },
      { iconName: "Hammer",    title: "Trituración de Tocones",   description: "Remoción completa de tocones por debajo del nivel para recuperar su jardín, plantar o construir.", benefits: ["Trituración Profunda", "Remoción de Escombros", "Listo para Replante"] },
      { iconName: "Truck",     title: "Limpieza de Emergencia",   description: "Respuesta de emergencia 24/7 para árboles caídos, ramas rotas y propiedades dañadas.",        benefits: ["Respuesta 24/7", "Árboles Caídos", "Protección de Propiedad"] },
      { iconName: "Shield",    title: "Evaluación de Salud",      description: "Inspecciones de arborista certificado para diagnosticar enfermedades y problemas estructurales.", benefits: ["Certificado ISA", "Diagnóstico de Enfermedades", "Plan de Tratamiento"] },
      { iconName: "Building2", title: "Limpieza de Terrenos",     description: "Limpieza completa de terrenos residenciales y comerciales para construcción o desarrollo.",     benefits: ["Limpieza de Lote Completo", "Remoción de Arbustos", "Preparación del Sitio"] },
    ],
  },

  reviews: {
    en: (city) => [
      { name: "Alice & Tom B.",  location: city, text: "They removed a massive oak that was threatening our house. The crew was professional, safe, and cleaned everything up. You'd never know it was there!" },
      { name: "Sam G.",          location: city, text: "Had three large trees trimmed and two stumps ground. All done in one day. The crew worked hard and left the yard spotless. Fair pricing too." },
      { name: "Maria C.",        location: city, text: "Called them after a storm knocked a tree onto our fence. They were there within 2 hours, removed the tree, and stacked the wood neatly. Outstanding response!" },
    ],
    es: (city) => [
      { name: "Alice y Tom B.",  location: city, text: "Removieron un roble enorme que amenazaba nuestra casa. El equipo fue profesional, seguro y limpió todo. ¡Nunca sabrías que estaba ahí!" },
      { name: "Sam G.",          location: city, text: "Podamos tres árboles grandes y trituramos dos tocones. Todo en un día. El equipo trabajó duro y dejó el jardín impecable. Buen precio también." },
      { name: "María C.",        location: city, text: "Los llamé después de que una tormenta tumbó un árbol sobre nuestra cerca. Estuvieron en 2 horas, removieron el árbol y apilaron la madera. ¡Respuesta excepcional!" },
    ],
  },
};

// ─── Exports ─────────────────────────────────────────────────────────────────────

export const TRADES = {
  painting,
  plumbing,
  roofing,
  electrician,
  landscaping,
  hvac,
  general,
  housecleaner,
  pressurewashing,
  carpenter,
  floorinstaller,
  tileinstaller,
  fenceinstaller,
  deckbuilder,
  shedbuilder,
  concrete,
  treeservice,
};

export const TRADE_KEYS = Object.keys(TRADES);

/**
 * Resolves the full payload for window.__PREVIEW__ given form fields.
 *
 * @param {object} opts
 * @param {string} opts.tradeKey   - one of TRADE_KEYS
 * @param {string} opts.name       - business name (overrides template)
 * @param {string} opts.city       - city (injected into template strings)
 * @param {string} opts.phone      - phone number
 * @param {string} opts.service    - freeform service label override (optional)
 * @param {string} opts.cta        - CTA button text override (optional)
 * @param {string} opts.lang       - "en" | "es"
 * @param {string} opts.logoUrl    - optional external logo URL
 * @param {string} opts.heroImageUrl - optional custom hero image URL
 * @param {string} opts.clientFirstName - prospect's first name (optional)
 */

/**
 * Builds a portfolio-style project list from galleryImages + services.
 * Returns null for painting (uses the real portfolioProjects data file).
 */
function buildPortfolio(galleryImages, services, tradeName, city) {
  if (!galleryImages) return null;
  return galleryImages.slice(0, 6).map((img, i) => {
    const svc = services[i % services.length];
    return {
      id:          String(i + 1),
      title:       svc ? `${svc.title} — ${city}` : `${tradeName} Project ${i + 1}`,
      location:    city,
      services:    svc ? [svc.title] : [tradeName],
      date:        `2025-${String(12 - (i % 12)).padStart(2, "0")}`,
      imageUrl:    img.url,
      imageAlt:    img.alt,
      description: svc ? svc.description : `Professional ${tradeName} work completed in ${city}.`,
    };
  });
}

export function buildPreviewPayload(opts) {
  const { tradeKey, name, city, phone, service, cta, lang, logoUrl, heroImageUrl, clientFirstName } = opts;
  const tpl = TRADES[tradeKey] || TRADES.painting;
  const l = lang === "es" ? "es" : "en";
  const tradeName = service || tpl.displayName[l];
  const bizName = name || (l === "es" ? "Contratista Profesional" : "Professional Contractor");
  const bizCity = city || (l === "es" ? "su ciudad" : "your city");
  const ctaText = cta || (l === "es" ? "Llama para cotización gratis" : "Get Your Free Estimate");
  const svcList = tpl.services[l];

  const localHeroUrl     = getHeroImage(tradeKey);
  const localGalleryUrls = getGalleryImages(tradeKey);
  const localSupportUrls = getSupportImages(tradeKey);

  const localGalleryObjs = localGalleryUrls.length
    ? localGalleryUrls.map((url, i) => ({ url, alt: `${tradeName} project ${i + 1}` }))
    : null;

  const resolvedHeroUrl  = heroImageUrl || localHeroUrl || tpl.heroImageUrl;
  const resolvedGallery  = localGalleryObjs || tpl.galleryImages;
  const resolvedAboutUrl = localSupportUrls[0] || tpl.aboutImageUrl;

  return {
    clientFirstName: clientFirstName || "",
    businessName:  bizName,
    city:          bizCity,
    phone:         phone || "(704) 555-0123",
    email:         `info@${bizName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
    trade:         tradeKey,
    tradeName,
    tradeNoun:     tpl.tradeNoun[l],
    tradeNounEN:   tpl.tradeNoun.en,
    tradeNounES:   tpl.tradeNoun.es,
    lang:          l,
    cta:           ctaText,
    logoUrl:       logoUrl || null,
    heroImageUrl:  resolvedHeroUrl,
    aboutImageUrl: resolvedAboutUrl,
    galleryImages: resolvedGallery,
    services:      svcList,
    servicesEN:    tpl.services.en,
    servicesES:    tpl.services.es,
    reviews:       tpl.reviews[l](bizCity),
    reviewsEN:     tpl.reviews.en(bizCity),
    reviewsES:     tpl.reviews.es(bizCity),
    portfolio:     buildPortfolio(resolvedGallery, svcList, tradeName, bizCity),
  };
}
