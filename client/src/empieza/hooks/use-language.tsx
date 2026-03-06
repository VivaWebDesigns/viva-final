import { createContext, useContext, useState, ReactNode } from "react";

type Language = "en" | "es";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Nav
    home: "Home",
    about: "About",
    services: "Services",
    reviews: "Reviews",
    contact: "Contact",
    getQuote: "Get a Quote",
    getFreeEstimate: "Get Your Free Estimate",
    
    // Hero
    heroTitle: "We've got your painting needs covered.",
    heroSubtitle: "Transforming homes across Charlotte with precision and passion. Quality interior and exterior painting that stands the test of time.",
    viewServices: "View Our Services",
    
    // About
    aboutUs: "About Us",
    hiDavid: "Hi there! My name is David.",
    aboutP1: "Welcome to Charlotte Painting Pro, proudly serving the greater Charlotte, North Carolina area. With over 15 years of hands-on experience, I'm dedicated to providing high-quality, personalized solutions for all your painting and staining needs.",
    aboutP2: "Whether you're looking to refresh your interior with a new color, boost your curb appeal with a full exterior repaint, or protect your deck and fence with a professional stain, I've got you covered. I handle every project personally — from small touch-ups to full transformations — ensuring each job is completed efficiently, correctly, and with attention to detail.",
    yearsExperience: "Years Experience",
    happyHomes: "Happy Homes",
    satisfaction: "100% Satisfaction",
    satisfactionSub: "We don't leave until you love it.",
    
    // Services
    ourExpertise: "Our Expertise",
    qualityServices: "Quality Painting Services",
    servicesSub: "From refreshing a single room to transforming your entire home exterior, we handle every detail with care.",
    service1Title: "Interior Painting",
    service1Desc: "Flawless finishes for your walls, ceilings, and trim. We protect your furniture and floors.",
    service1B1: "Walls & Ceilings",
    service1B2: "Trim & Molding",
    service1B3: "Drywall Repair",
    service2Title: "Exterior Painting",
    service2Desc: "Boost curb appeal and protect your home from the elements with premium exterior paints.",
    service2B1: "Siding Painting",
    service2B2: "Brick Painting",
    service2B3: "Pressure Washing",
    service3Title: "Kitchen Cabinets",
    service3Desc: "Modernize your kitchen for a fraction of the cost of replacing cabinets.",
    service3B1: "Factory Finish",
    service3B2: "Hardware Updates",
    service3B3: "Color Consulting",
    service4Title: "Deck Staining",
    service4Desc: "Restore the beauty of your deck with professional staining or painting.",
    service4B1: "Cleaning & Sanding",
    service4B2: "Stain or Paint Application",
    service4B3: "Minor Repairs",
    service5Title: "Fence Staining",
    service5Desc: "Extend the life and beauty of your fence with professional staining or painting.",
    service5B1: "Wood Prep & Cleaning",
    service5B2: "Stain or Paint Application",
    service5B3: "Weatherproof Sealing",
    
    // Why Us
    whyUs: "Why us?",
    qualityCountOn: "Quality you can count on",
    whyUsP1: "Every project starts with a conversation. We listen to your vision, understand your goals, and deliver results that bring your space to life — on time and with no surprises.",
    whyUsP2: "With years of hands-on experience, our crew is equipped to take on jobs of any size, whether it's a fresh coat in the living room or a full exterior makeover with custom detail work.",
    fullyInsured: "Fully Insured",
    onTimeGuarantee: "On-Time Guarantee",
    cleanWork: "Clean Work",
    
    // Reviews
    whatClientsSay: "What our clients say",
    sampleReviews: "*Sample reviews. More reviews available upon request.",
    bookQuote: "Book a Paint Quote",
    
    // Contact
    letUsHelp: "Let us know how we can help!",
    contactSub: "Contact us today to learn more about how we can help you enhance the beauty and functionality of your home.",
    emailUs: "Email Us",
    callUs: "Call Us",
    monSat: "Mon-Sat, 8am - 6pm",
    
    // Form
    requestEstimate: "Request a Free Estimate",
    formSub: "Fill out the form below and David will get back to you within 24 hours.",
    fullName: "Full Name",
    emailAddress: "Email Address",
    phoneNumber: "Phone Number",
    zipCode: "Zip Code",
    serviceNeeded: "Service Needed",
    projectDetails: "Project Details",
    placeholderName: "John Smith",
    placeholderEmail: "john@example.com",
    placeholderPhone: "(704) 555-0123",
    placeholderZip: "28202",
    placeholderService: "Select a service",
    placeholderMessage: "Tell us about your project...",
    getQuoteBtn: "Get My Free Quote",
    sending: "Sending...",
    
    // Footer
    rights: "All rights reserved.",
    stickyCall: "Call for Free Estimate",

    // Review 1
    review1Name: "Sarah Jenkins",
    review1Loc: "Dilworth, Charlotte",
    review1Text: "David and his team were incredible. They painted our entire downstairs in two days and left the place spotless. The lines are perfect!",
    // Review 2
    review2Name: "Mike & Linda Ross",
    review2Loc: "Matthews, NC",
    review2Text: "We hired them for exterior painting and deck staining. The house looks brand new. Very professional and friendly crew.",
    // Review 3
    review3Name: "Elena Rodriguez",
    review3Loc: "Ballantyne",
    review3Text: "Best quote we received and the quality exceeded our expectations. David helped us choose the perfect gray for our kitchen cabinets.",
    // Review 4
    review4Name: "James & Pat Wilson",
    review4Loc: "Myers Park",
    review4Text: "David's team was respectful of our home and did a fantastic job on our exterior trim. Highly recommend!",
    // Review 5
    review5Name: "Robert Chen",
    review5Loc: "South Charlotte",
    review5Text: "Professional, punctual, and reasonably priced. The deck looks great after the staining."
  },
  es: {
    // Nav
    home: "Inicio",
    about: "Nosotros",
    services: "Servicios",
    reviews: "Reseñas",
    contact: "Contacto",
    getQuote: "Cotizar",
    getFreeEstimate: "Obtenga su presupuesto gratuito",
    
    // Hero
    heroTitle: "Cubrimos todas sus necesidades de pintura.",
    heroSubtitle: "Transformando hogares en Charlotte con precisión y pasión. Pintura de interiores y exteriores de calidad que resiste el paso del tiempo.",
    viewServices: "Ver nuestros servicios",
    
    // About
    aboutUs: "Sobre nosotros",
    hiDavid: "¡Hola! Mi nombre es David.",
    aboutP1: "Bienvenido a Charlotte Painting Pro, sirviendo con orgullo al área metropolitana de Charlotte, Carolina del Norte. Con más de 15 años de experiencia práctica, me dedico a brindar soluciones personalizadas y de alta calidad para todas sus necesidades de pintura y teñido.",
    aboutP2: "Ya sea que busque renovar su interior con un nuevo color, mejorar el atractivo exterior de su casa con una pintura completa o proteger su terraza y cerca con un tinte profesional, yo me encargo. Manejo cada proyecto personalmente, desde pequeños retoques hasta transformaciones completas, asegurando que cada trabajo se complete de manera eficiente, correcta y con atención al detalle.",
    yearsExperience: "Años de experiencia",
    happyHomes: "Hogares felices",
    satisfaction: "100% Satisfacción",
    satisfactionSub: "No nos vamos hasta que le encante.",
    
    // Services
    ourExpertise: "Nuestra experiencia",
    qualityServices: "Servicios de pintura de calidad",
    servicesSub: "Desde renovar una sola habitación hasta transformar todo el exterior de su hogar, manejamos cada detalle con cuidado.",
    service1Title: "Pintura de interiores",
    service1Desc: "Acabados impecables para sus paredes, techos y molduras. Protegemos sus muebles y pisos.",
    service1B1: "Paredes y techos",
    service1B2: "Molduras",
    service1B3: "Reparación de paneles de yeso",
    service2Title: "Pintura de exteriores",
    service2Desc: "Aumente el atractivo exterior y proteja su hogar de los elementos con pinturas de primera calidad.",
    service2B1: "Pintura de revestimiento",
    service2B2: "Pintura de ladrillo",
    service2B3: "Lavado a presión",
    service3Title: "Gabinetes de cocina",
    service3Desc: "Modernice su cocina por una fracción del costo de reemplazar los gabinetes.",
    service3B1: "Acabado de fábrica",
    service3B2: "Actualización de herrajes",
    service3B3: "Consulta de color",
    service4Title: "Teñido de terrazas",
    service4Desc: "Restaure la belleza de su terraza con teñido o pintura profesional.",
    service4B1: "Limpieza y lijado",
    service4B2: "Aplicación de tinte o pintura",
    service4B3: "Reparaciones menores",
    service5Title: "Teñido de cercas",
    service5Desc: "Extienda la vida y belleza de su cerca con teñido o pintura profesional.",
    service5B1: "Preparación y limpieza de madera",
    service5B2: "Aplicación de tinte o pintura",
    service5B3: "Sellado resistente a la intemperie",
    
    // Why Us
    whyUs: "¿Por qué nosotros?",
    qualityCountOn: "Calidad con la que puede contar",
    whyUsP1: "Cada proyecto comienza con una conversación. Escuchamos su visión, entendemos sus objetivos y entregamos resultados que dan vida a su espacio, a tiempo y sin sorpresas.",
    whyUsP2: "Con años de experiencia práctica, nuestro equipo está equipado para realizar trabajos de cualquier tamaño, ya sea una capa fresca en la sala o una renovación exterior completa con detalles personalizados.",
    fullyInsured: "Totalmente asegurado",
    onTimeGuarantee: "Garantía de puntualidad",
    cleanWork: "Trabajo limpio",
    
    // Reviews
    whatClientsSay: "Lo que dicen nuestros clientes",
    sampleReviews: "*Reseñas de muestra. Más reseñas disponibles a pedido.",
    bookQuote: "Reserve una cotización",
    
    // Contact
    letUsHelp: "¡Háganos saber cómo podemos ayudar!",
    contactSub: "Contáctenos hoy para obtener más información sobre cómo podemos ayudarlo a mejorar la belleza y funcionalidad de su hogar.",
    emailUs: "Envíenos un correo",
    callUs: "Llámenos",
    monSat: "Lun-Sáb, 8am - 6pm",
    
    // Form
    requestEstimate: "Solicite un presupuesto gratuito",
    formSub: "Complete el formulario a continuación y David se pondrá en contacto con usted en 24 horas.",
    fullName: "Nombre completo",
    emailAddress: "Correo electrónico",
    phoneNumber: "Número de teléfono",
    zipCode: "Código postal",
    serviceNeeded: "Servicio necesario",
    projectDetails: "Detalles del proyecto",
    placeholderName: "Juan Pérez",
    placeholderEmail: "juan@ejemplo.com",
    placeholderPhone: "(704) 555-0123",
    placeholderZip: "28202",
    placeholderService: "Seleccione un servicio",
    placeholderMessage: "Cuéntenos sobre su proyecto...",
    getQuoteBtn: "Obtener mi cotización gratuita",
    sending: "Enviando...",
    
    // Footer
    rights: "Todos los derechos reservados.",
    stickyCall: "Llamar para presupuesto gratuito",

    // Reseña 1
    review1Name: "Sarah Jenkins",
    review1Loc: "Dilworth, Charlotte",
    review1Text: "David y su equipo fueron increíbles. Pintaron toda nuestra planta baja en dos días y dejaron el lugar impecable. ¡Las líneas son perfectas!",
    // Reseña 2
    review2Name: "Mike y Linda Ross",
    review2Loc: "Matthews, NC",
    review2Text: "Los contratamos para pintura exterior y teñido de terrazas. La casa parece nueva. Un equipo muy profesional y amable.",
    // Reseña 3
    review3Name: "Elena Rodriguez",
    review3Loc: "Ballantyne",
    review3Text: "La mejor cotización que recibimos y la calidad superó nuestras expectativas. David nos ayudó a elegir el gris perfecto para nuestros gabinetes de cocina.",
    // Reseña 4
    review4Name: "James y Pat Wilson",
    review4Loc: "Myers Park",
    review4Text: "El equipo de David fue respetuoso con nuestro hogar y realizó un trabajo fantástico en nuestras molduras exteriores. ¡Altamente recomendados!",
    // Reseña 5
    review5Name: "Robert Chen",
    review5Loc: "South Charlotte",
    review5Text: "Profesional, puntual y a un precio razonable. La terraza luce genial después del teñido."
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Allow the preview entry point to set the initial language via window.__PREVIEW__.lang.
  // Falls back to "en" for the standard public demo.
  const [language, setLanguage] = useState<Language>(
    ((window as any).__PREVIEW__?.lang as Language) || "en"
  );

  const t = (key: string) => {
    // Preview override: if window.__PREVIEW__.tOverrides has this key, use it instead.
    // This lets the /preview/empieza page inject custom business name, city, phone, etc.
    const previewOverrides = (window as any).__PREVIEW__?.tOverrides || {};
    if (previewOverrides[key] !== undefined) return previewOverrides[key];
    return translations[language][key as keyof typeof translations["en"]] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
