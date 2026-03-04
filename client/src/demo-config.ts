export type DemoTier = "empieza" | "crece" | "domina";

export interface TierConfig {
  url: string;
  name: string;
  color: "gray" | "blue" | "gold";
  tagline: string;
  description: string;
  features: string[];
}

export const demoConfig: Record<DemoTier, TierConfig> = {
  empieza: {
    url: "https://viva-empieza-website.replit.app",
    name: "Empieza",
    color: "gray",
    tagline: "Base profesional",
    description:
      "Tu primera presencia profesional en internet para empezar a generar confianza y recibir más llamadas.",
    features: [
      "Sitio web profesional de 1 página",
      "Diseño moderno y responsivo",
      "WhatsApp + Click-to-Call",
      "Optimización SEO básica",
      "Imágenes profesionales incluidas",
      "Hosting + SSL + Soporte",
    ],
  },
  crece: {
    url: "",
    name: "Crece",
    color: "blue",
    tagline: "La opción más elegida",
    description:
      "Marketing completo para recibir más llamadas, aparecer en Google y superar a tu competencia.",
    features: [
      "Sitio web de hasta 6 páginas",
      "SEO local avanzado",
      "Galería de trabajos",
      "Página de reseñas + estrategia",
      "Perfil de Google Business optimizado",
      "Soporte prioritario por WhatsApp",
    ],
  },
  domina: {
    url: "",
    name: "Domina",
    color: "gold",
    tagline: "Máximo posicionamiento",
    description:
      "El paquete premium para ser la opción #1 en tu mercado local y dominar a la competencia.",
    features: [
      "Sitio web de hasta 12 páginas",
      "Estrategia SEO agresiva",
      "Optimización por cada servicio",
      "Mejora continua de Google Business",
      "Upgrade de branding profesional",
      "Soporte de proyecto prioritario",
    ],
  },
};

export const tierColors: Record<
  TierConfig["color"],
  { text: string; border: string; bg: string; badge: string; button: string; activeBg: string }
> = {
  gray: {
    text: "text-slate-300",
    border: "border-slate-400",
    bg: "bg-slate-500/10",
    badge: "bg-slate-500/20 text-slate-300",
    button: "bg-slate-600 hover:bg-slate-500 text-white",
    activeBg: "bg-slate-700/60",
  },
  blue: {
    text: "text-blue-300",
    border: "border-blue-400",
    bg: "bg-blue-500/10",
    badge: "bg-blue-500/20 text-blue-300",
    button: "bg-blue-600 hover:bg-blue-500 text-white",
    activeBg: "bg-blue-900/40",
  },
  gold: {
    text: "text-amber-300",
    border: "border-amber-400",
    bg: "bg-amber-500/10",
    badge: "bg-amber-500/20 text-amber-300",
    button: "bg-amber-600 hover:bg-amber-500 text-white",
    activeBg: "bg-amber-900/30",
  },
};
