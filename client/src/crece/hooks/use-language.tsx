import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "en" | "es";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    "nav.home": "Home",
    "nav.services": "Services",
    "nav.gallery": "Gallery",
    "nav.about": "About",
    "nav.reviews": "Reviews",
    "nav.contact": "Contact",
    "nav.getQuote": "Get a Quote",
    "nav.freeEstimate": "Get Your Free Estimate",
    "hero.title": "We've got your painting needs covered.",
    "hero.subtitle": "Transforming homes across Charlotte with precision and passion. Quality interior and exterior painting that stands the test of time.",
    "hero.viewServices": "View Our Services",
    "services.title": "Quality Painting Services",
    "services.subtitle": "Our Expertise",
    "services.description": "From refreshing a single room to transforming your entire home exterior, we handle every detail with care.",
    "services.interior": "Interior Painting",
    "services.exterior": "Exterior Painting",
    "services.cabinets": "Kitchen Cabinets",
    "services.deck": "Deck Staining & Painting",
    "services.fence": "Fence Staining & Painting",
    "services.commercial": "Commercial Painting",
    "services.viewAll": "View All Services",
    "services.interior.desc": "Flawless finishes for your walls, ceilings, and trim. We protect your furniture and floors.",
    "services.exterior.desc": "Boost curb appeal and protect your home from the elements with premium exterior paints.",
    "services.cabinets.desc": "Modernize your kitchen for a fraction of the cost of replacing cabinets.",
    "services.deck.desc": "Restore the beauty of your deck with professional staining or painting.",
    "services.fence.desc": "Protect and beautify your fence with a professional stain or paint finish.",
    "services.commercial.desc": "Professional painting for offices, retail spaces, and restaurants with minimal disruption.",
    "services.recentProjects": "Recent Projects",
    "services.ourWork": "Our Work",
    "services.areaTitle": "Service Area",
    "services.areaDesc": "We proudly serve Charlotte and the surrounding communities, including Matthews, Mint Hill, Pineville, Huntersville, Concord, Gastonia, and Fort Mill, SC.",
    "why.title": "Quality you can count on",
    "why.subtitle": "Why Choose Us",
    "why.desc": "Every project starts with a conversation. We listen to your vision, understand your goals, and deliver results that bring your space to life.",
    "why.insured": "Fully Insured",
    "why.insured.desc": "Your home is protected. We carry full liability insurance on every project.",
    "why.ontime": "On-Time Guarantee",
    "why.ontime.desc": "We show up when we say we will and finish on schedule. No surprises.",
    "why.clean": "Clean Work",
    "why.clean.desc": "We treat your home like our own. Clean lines, clean floors, clean results.",
    "reviews.title": "What our clients say",
    "reviews.subtitle": "Reviews",
    "reviews.note": "*Sample reviews. More reviews available upon request.",
    "reviews.book": "Book a Paint Quote",
    "cta.title": "Ready to transform your home?",
    "cta.desc": "Get a free, no-obligation estimate from David. We serve Charlotte and the surrounding area.",
    "footer.rights": "All rights reserved.",
    "footer.desc": "Charlotte's premier painting experts. We bring color and life to your home with professional interior and exterior painting services.",
    "footer.links": "Quick Links",
    "contact.title": "Let us know how we can help!",
    "contact.subtitle": "Get In Touch",
    "contact.desc": "Contact us today to learn more about how we can help you enhance the beauty and functionality of your home.",
    "contact.email": "Email Us",
    "contact.call": "Call Us",
    "contact.form.title": "Fill Out the Form Below",
    "contact.form.cta": "Call for Free Estimate",
    "contact.area": "Service Area",
    "contact.hours": "Business Hours",
    "contact.hours.mon_sat": "Monday - Saturday",
    "contact.hours.sunday": "Sunday: Closed",
    "contact.promise": "Our Promise",
    "contact.promise.desc": "Fully insured, clean work, and we respect your home. Your satisfaction is guaranteed.",
    "about.title": "Hi there! My name is David.",
    "about.subtitle": "About Us",
    "about.description1": "Welcome to Charlotte Painting Pro, proudly serving the greater Charlotte, North Carolina area. With over 15 years of hands-on experience, I'm dedicated to providing high-quality, personalized solutions for all your painting and staining needs.",
    "about.description2": "Whether you're looking to refresh your interior with a new color, boost your curb appeal with a full exterior repaint, or protect your deck and fence with a professional stain, I've got you covered. I handle every project personally — from small touch-ups to full transformations — ensuring each job is completed efficiently, correctly, and with attention to detail.",
    "about.exp": "Years Experience",
    "about.homes": "Happy Homes",
    "about.values": "Our Values",
    "about.values.desc": "At Charlotte Painting Pro, we believe in honest pricing, clear communication, and doing the job right the first time. We treat your home with the same care and respect we'd give our own. That's the foundation of every project we take on.",
    "about.contact": "Contact Us Today",
    "about.satisfaction": "100% Satisfaction",
    "about.satisfactionDesc": "We don't leave until you love it.",
    "gallery.title": "Project Gallery",
    "gallery.subtitle": "Our Work",
    "gallery.desc": "See the quality for yourself. Here are some of our recent painting and staining projects across the Charlotte area.",
    "gallery.cta.title": "Like what you see?",
    "gallery.cta.desc": "Let's talk about your next project. Get a free, no-obligation estimate from David.",
    "gallery.noProjects": "No projects found in this category yet.",
    "form.fullName": "Full Name",
    "form.email": "Email Address",
    "form.phone": "Phone Number",
    "form.zipCode": "Zip Code",
    "form.service": "Service Needed",
    "form.details": "Project Details",
    "form.other": "Other",
    "form.placeholder.name": "John Smith",
    "form.placeholder.email": "john@example.com",
    "form.placeholder.phone": "(704) 555-0123",
    "form.placeholder.zip": "28202",
    "form.placeholder.service": "Select a service",
    "form.placeholder.message": "Tell us about your project...",
    "form.submit": "Get My Free Quote",
    "form.sending": "Sending...",
    "form.heading": "Get Your Free Estimate",
    "form.sub": "Fill out the form below and David will get back to you within 24 hours.",
    "toast.estimateTitle": "Estimate Requested",
    "toast.estimateDesc": "Thank you! We will contact you shortly to schedule your free estimate.",
    "toast.errorTitle": "Error",
    "toast.errorDesc": "Something went wrong. Please try calling us instead.",
  },
  es: {
    "nav.home": "Inicio",
    "nav.services": "Servicios",
    "nav.gallery": "Galería",
    "nav.about": "Nosotros",
    "nav.reviews": "Reseñas",
    "nav.contact": "Contacto",
    "nav.getQuote": "Obtener Presupuesto",
    "nav.freeEstimate": "Obtenga su Estimación Gratis",
    "hero.title": "Cubrimos todas sus necesidades de pintura.",
    "hero.subtitle": "Transformando hogares en Charlotte con precisión y pasión. Pintura interior y exterior de calidad que perdura en el tiempo.",
    "hero.viewServices": "Ver Nuestros Servicios",
    "services.title": "Servicios de Pintura de Calidad",
    "services.subtitle": "Nuestra Experiencia",
    "services.description": "Desde refrescar una sola habitación hasta transformar todo el exterior de su hogar, manejamos cada detalle con cuidado.",
    "services.interior": "Pintura de Interiores",
    "services.exterior": "Pintura de Exteriores",
    "services.cabinets": "Gabinetes de Cocina",
    "services.deck": "Teñido y Pintura de Terrazas",
    "services.fence": "Teñido y Pintura de Cercas",
    "services.commercial": "Pintura Comercial",
    "services.viewAll": "Ver Todos los Servicios",
    "services.interior.desc": "Acabados impecables para sus paredes, techos y molduras. Protegemos sus muebles y suelos.",
    "services.exterior.desc": "Aumente el atractivo visual y proteja su hogar de los elementos con pinturas exteriores de primera calidad.",
    "services.cabinets.desc": "Modernice su cocina por una fracción del costo de reemplazar los gabinetes.",
    "services.deck.desc": "Restaure la belleza de su terraza con teñido o pintura profesional.",
    "services.fence.desc": "Proteja y embellezca su cerca con un acabado profesional de tinte o pintura.",
    "services.commercial.desc": "Pintura profesional para oficinas, espacios comerciales y restaurantes con interrupciones mínimas.",
    "services.recentProjects": "Proyectos Recientes",
    "services.ourWork": "Nuestro Trabajo",
    "services.areaTitle": "Área de Servicio",
    "services.areaDesc": "Servimos con orgullo a Charlotte y las comunidades circundantes, incluyendo Matthews, Mint Hill, Pineville, Huntersville, Concord, Gastonia y Fort Mill, SC.",
    "why.title": "Calidad con la que puede contar",
    "why.subtitle": "Por Qué Elegirnos",
    "why.desc": "Cada proyecto comienza con una conversación. Escuchamos su visión, entendemos sus objetivos y entregamos resultados que dan vida a su espacio.",
    "why.insured": "Totalmente Asegurado",
    "why.insured.desc": "Su hogar está protegido. Contamos con seguro de responsabilidad civil total en cada proyecto.",
    "why.ontime": "Garantía de Puntualidad",
    "why.ontime.desc": "Nos presentamos cuando decimos que lo haremos y terminamos a tiempo. Sin sorpresas.",
    "why.clean": "Trabajo Limpio",
    "why.clean.desc": "Tratamos su hogar como si fuera el nuestro. Líneas limpias, suelos limpios, resultados limpios.",
    "reviews.title": "Lo que dicen nuestros clientes",
    "reviews.subtitle": "Reseñas",
    "reviews.note": "*Reseñas de muestra. Más reseñas disponibles a pedido.",
    "reviews.book": "Reservar Presupuesto",
    "cta.title": "¿Listo para transformar su hogar?",
    "cta.desc": "Obtenga una estimación gratuita y sin compromiso de David. Servimos a Charlotte y el área circundante.",
    "footer.rights": "Todos los derechos reservados.",
    "footer.desc": "Los expertos en pintura líderes en Charlotte. Aportamos color y vida a su hogar con servicios profesionales de pintura interior y exterior.",
    "footer.links": "Enlaces Rápidos",
    "contact.title": "¡Cuéntenos cómo podemos ayudar!",
    "contact.subtitle": "Póngase en Contacto",
    "contact.desc": "Contáctenos hoy para obtener más información sobre cómo podemos ayudarlo a mejorar la belleza y funcionalidad de su hogar.",
    "contact.email": "Envíenos un Correo",
    "contact.call": "Llámenos",
    "contact.form.title": "Complete el Formulario a Continuación",
    "contact.form.cta": "Llamar para Estimación Gratis",
    "contact.area": "Área de Servicio",
    "contact.hours": "Horario Comercial",
    "contact.hours.mon_sat": "Lunes - Sábado",
    "contact.hours.sunday": "Domingo: Cerrado",
    "contact.promise": "Nuestra Promesa",
    "contact.promise.desc": "Totalmente asegurado, trabajo limpio y respetamos su hogar. Su satisfacción está garantizada.",
    "about.title": "¡Hola! Mi nombre es David.",
    "about.subtitle": "Nosotros",
    "about.description1": "Bienvenido a Charlotte Painting Pro, sirviendo con orgullo al área metropolitana de Charlotte, Carolina del Norte. Con más de 15 años de experiencia práctica, me dedico a brindar soluciones personalizadas y de alta calidad para todas sus necesidades de pintura y teñido.",
    "about.description2": "Ya sea que esté buscando refrescar su interior con un nuevo color, aumentar el atractivo visual con un repintado exterior completo o proteger su terraza y cerca con un tinte profesional, lo tengo cubierto. Manejo cada proyecto personalmente — desde pequeños retoques hasta transformaciones completas — asegurando que cada trabajo se complete de manera eficiente, correcta y con atención al detalle.",
    "about.exp": "Años de Experiencia",
    "about.homes": "Hogares Felices",
    "about.values": "Nuestros Valores",
    "about.values.desc": "En Charlotte Painting Pro, creemos en precios honestos, comunicación clara y hacer el trabajo bien desde la primera vez. Tratamos su hogar con el mismo cuidado y respeto que le daríamos al nuestro. Esa es la base de cada proyecto que emprendemos.",
    "about.contact": "Contáctenos Hoy",
    "about.satisfaction": "100% de Satisfacción",
    "about.satisfactionDesc": "No nos vamos hasta que le encante.",
    "gallery.title": "Galería de Proyectos",
    "gallery.subtitle": "Nuestro Trabajo",
    "gallery.desc": "Vea la calidad por sí mismo. Aquí hay algunos de nuestros proyectos recientes de pintura y teñido en el área de Charlotte.",
    "gallery.cta.title": "¿Le gusta lo que ve?",
    "gallery.cta.desc": "Hablemos de su próximo proyecto. Obtenga una estimación gratuita y sin compromiso de David.",
    "gallery.noProjects": "Aún no se han encontrado proyectos en esta categoría.",
    "form.fullName": "Nombre Completo",
    "form.email": "Correo Electrónico",
    "form.phone": "Número de Teléfono",
    "form.zipCode": "Código Postal",
    "form.service": "Servicio Necesario",
    "form.details": "Detalles del Proyecto",
    "form.other": "Otro",
    "form.placeholder.name": "Juan Pérez",
    "form.placeholder.email": "juan@ejemplo.com",
    "form.placeholder.phone": "(704) 555-0123",
    "form.placeholder.zip": "28202",
    "form.placeholder.service": "Seleccione un servicio",
    "form.placeholder.message": "Cuéntenos sobre su proyecto...",
    "form.submit": "Obtener Mi Presupuesto Gratis",
    "form.sending": "Enviando...",
    "form.heading": "Obtenga su Estimación Gratis",
    "form.sub": "Complete el formulario a continuación y nos pondremos en contacto en 24 horas.",
    "toast.estimateTitle": "Estimación Solicitada",
    "toast.estimateDesc": "¡Gracias! Nos pondremos en contacto con usted en breve para programar su estimación gratuita.",
    "toast.errorTitle": "Error",
    "toast.errorDesc": "Algo salió mal. Por favor, intente llamarnos en su lugar.",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("language");
    return (saved as Language) || "en";
  });

  useEffect(() => {
    localStorage.setItem("language", language);
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string) => {
    // Preview override: supports both flat { key: value } and language-aware { en: {...}, es: {...} }.
    // Language-aware format ensures switching to ES returns Spanish override strings.
    const previewOverrides = window.__PREVIEW__?.tOverrides || {};
    const langOverrides: Record<string, string> =
      (previewOverrides.en && previewOverrides.es)
        ? ((previewOverrides[language] as Record<string, string>) || {})
        : (previewOverrides as Record<string, string>);
    if (langOverrides[key] !== undefined) return langOverrides[key];
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
