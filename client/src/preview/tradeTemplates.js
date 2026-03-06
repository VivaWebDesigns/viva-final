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
 *   1. Client overrides (form fields)
 *   2. Trade template values
 *   3. Generic painting defaults (the original demo content)
 *
 * Image format: Unsplash CDN — free to embed, no API key required
 */

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

// ─── Exports ─────────────────────────────────────────────────────────────────────

export const TRADES = {
  painting,
  plumbing,
  roofing,
  electrician,
  landscaping,
  hvac,
  general,
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
 */
export function buildPreviewPayload(opts) {
  const { tradeKey, name, city, phone, service, cta, lang, logoUrl, heroImageUrl } = opts;
  const tpl = TRADES[tradeKey] || TRADES.painting;
  const l = lang === "es" ? "es" : "en";
  const tradeName = service || tpl.displayName[l];
  const bizName = name || (l === "es" ? "Contratista Profesional" : "Professional Contractor");
  const bizCity = city || (l === "es" ? "su ciudad" : "your city");
  const ctaText = cta || (l === "es" ? "Llama para cotización gratis" : "Get Your Free Estimate");

  return {
    businessName:  bizName,
    city:          bizCity,
    phone:         phone || "(704) 555-0123",
    email:         `info@${bizName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
    trade:         tradeKey,
    tradeName,
    tradeNoun:     tpl.tradeNoun[l],
    lang:          l,
    cta:           ctaText,
    logoUrl:       logoUrl || null,
    heroImageUrl:  heroImageUrl || tpl.heroImageUrl,
    aboutImageUrl: tpl.aboutImageUrl,
    galleryImages: tpl.galleryImages,
    services:      tpl.services[l],
    reviews:       tpl.reviews[l](bizCity),
  };
}
