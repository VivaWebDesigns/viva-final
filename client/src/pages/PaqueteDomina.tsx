import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Crown, Globe, Search, BarChart3, Users, Palette, Settings, FileText, Headphones, Phone, Image, Star, Rocket, Zap, Shield } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { motion } from "framer-motion";
import SEO from "@/components/SEO";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const included = [
  {
    icon: Globe,
    title: "Sitio Web Ilimitado + Blog",
    desc: "Sin límite de páginas. Blog integrado donde publicamos artículos mensuales que te posicionan como el experto en tu industria y atraen tráfico orgánico de Google.",
    why: "Un blog activo le dice a Google que tu sitio es relevante. Más contenido = más posiciones = más clientes.",
  },
  {
    icon: Search,
    title: "SEO Agresivo + Contenido Mensual",
    desc: "No solo optimizamos — dominamos. Investigación profunda de keywords, contenido mensual nuevo, optimización técnica continua y monitoreo de posiciones contra tu competencia.",
    why: "El SEO agresivo te pone en las primeras posiciones y mantiene a tu competencia detrás.",
  },
  {
    icon: BarChart3,
    title: "Google Ads Avanzado",
    desc: "Campañas de búsqueda, display y remarketing totalmente gestionadas. Optimización continua de keywords, audiencias y presupuesto para maximizar cada dólar que inviertes.",
    why: "Google Ads avanzado genera llamadas inmediatas mientras el SEO construye resultados a largo plazo.",
  },
  {
    icon: Users,
    title: "Gestión Completa de Redes Sociales",
    desc: "Creación de contenido, publicaciones semanales, historias, engagement con tu audiencia y estrategia de crecimiento en Facebook e Instagram.",
    why: "Las redes sociales construyen tu marca y generan confianza antes de que te llamen.",
  },
  {
    icon: Image,
    title: "Galería + Portafolio + Reseñas",
    desc: "Todo lo del Plan Crece: galería profesional de tu trabajo, portafolio organizado por proyecto, página de reseñas con estrategia automatizada de solicitud.",
    why: "Prueba social completa: tu trabajo, tus reseñas, tu profesionalismo. Todo en un solo lugar.",
  },
  {
    icon: Settings,
    title: "Automatización y CRM",
    desc: "Sistema completo para seguimiento de leads: emails automáticos, recordatorios, pipeline de ventas y reportes. Nunca pierdas un cliente potencial por falta de seguimiento.",
    why: "El 80% de las ventas se pierden por falta de seguimiento. Con CRM, no pierdes ni una.",
  },
  {
    icon: Palette,
    title: "Branding Profesional Completo",
    desc: "Diseño de logo, paleta de colores, tipografía, tarjetas de presentación y guía de marca completa. Tu negocio tendrá una identidad visual que compite con las empresas más grandes.",
    why: "Una marca profesional te diferencia y justifica precios más altos.",
  },
  {
    icon: FileText,
    title: "Reportes Semanales de Rendimiento",
    desc: "Cada semana recibes un reporte claro con las métricas que importan: llamadas generadas, visitas al sitio, posiciones en Google, rendimiento de ads y ROI.",
    why: "Sabrás exactamente cuánto estás ganando por cada dólar invertido en marketing.",
  },
  {
    icon: Headphones,
    title: "Gerente de Cuenta Dedicado",
    desc: "Un profesional de marketing dedicado que conoce tu negocio, tu mercado y tus metas. Disponible por WhatsApp, teléfono y email. Tu socio de crecimiento.",
    why: "No eres un ticket más. Tienes a alguien que se preocupa por tus resultados como tú.",
  },
];

export default function PaqueteDomina() {
  return (
    <div className="overflow-x-hidden">
      <SEO
        title="Plan Domina - Sé El #1 En Tu Mercado"
        description="El plan premium para contratistas que quieren dominar. Marketing completo: web ilimitada, SEO agresivo, Google Ads, redes sociales, CRM y gerente dedicado desde $1,997/mes."
        path="/paquetes/domina"
      />

      {/* HERO */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-[#111] overflow-hidden" data-testid="section-domina-hero">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#1DB954] rounded-full blur-[180px] -translate-y-1/2 translate-x-1/4" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-3xl">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Crown className="w-4 h-4 text-white" />
              <span className="text-sm text-white/90 font-medium">Plan Domina</span>
              <span className="bg-white text-[#1DB954] text-xs font-bold px-2 py-0.5 rounded-full uppercase">Premium</span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" data-testid="text-domina-title">
              No compitas.{" "}
              <span className="text-emerald-200">Domina.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-white/80 leading-relaxed mb-8 max-w-2xl">
              El paquete completo para contratistas que quieren ser la primera y única opción en su mercado. Marketing integral que no deja nada al azar.
            </motion.p>
            <motion.p variants={fadeUp} className="text-4xl font-extrabold text-white mb-2">
              desde $1,997
            </motion.p>
            <motion.p variants={fadeUp} className="text-xs text-white/60 font-medium mb-8">Más plan mensual requerido.</p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start gap-4">
              <Link href="/contacto">
                <Button size="lg" className="bg-[#1DB954] text-white font-bold text-lg gap-2 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-domina-cta">
                  Quiero Dominar
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="https://wa.me/1234567890?text=Hola%2C%20me%20interesa%20el%20Plan%20Domina" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-domina-whatsapp">
                  <SiWhatsapp className="w-5 h-5" />
                  Hablar por WhatsApp
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-domina-ideal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp}>
              <p className="text-[#1DB954] font-bold text-sm uppercase tracking-widest mb-4">¿Para Quién Es?</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111] dark:text-white leading-tight mb-6" data-testid="text-domina-ideal-title">
                Este plan es para ti si...
              </h2>
              <ul className="space-y-4">
                {[
                  "Tienes un negocio establecido con un equipo y quieres ser el #1 en tu área",
                  "Estás cansado de ver a tu competencia más arriba que tú en Google",
                  "Quieres un marketing completo: web, SEO, ads, redes sociales y CRM",
                  "Estás listo para invertir seriamente porque sabes que el retorno vale la pena",
                  "Necesitas un socio de marketing que entienda tu negocio, no solo un proveedor",
                  "Quieres automatizar tu proceso de ventas y dejar de perder leads",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#1DB954] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp} className="bg-gradient-to-br from-[#1DB954] to-[#1aa34a] rounded-md p-1">
              <div className="bg-white dark:bg-[#111] rounded-md p-8 lg:p-10 text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="text-sm font-bold text-[#1DB954] uppercase tracking-wider">Premium</span>
                </div>
                <Crown className="w-16 h-16 text-[#1DB954] mx-auto mb-6" />
                <h3 className="text-2xl font-extrabold text-[#111] dark:text-white mb-3">Plan Domina</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">El arma secreta de los contratistas #1</p>
                <p className="text-5xl font-extrabold text-[#1DB954] mb-1">$1,997</p>
                <p className="text-[10px] text-gray-400 font-medium mb-4">Más plan mensual requerido.</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* WHAT'S INCLUDED — BENEFIT DRIVEN */}
      <section className="py-24 lg:py-40 bg-[#f5f5f5] dark:bg-[#111]" data-testid="section-domina-features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
            <motion.p variants={fadeUp} className="text-[#1DB954] font-bold text-sm uppercase tracking-widest mb-4">Qué Incluye</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-domina-features-title">
              Marketing Completo Para <span className="text-[#1DB954]">Dominar Tu Mercado</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="space-y-8">
            {included.map((item) => (
              <motion.div key={item.title} variants={fadeUp} className="bg-white dark:bg-gray-800 rounded-md p-8 lg:p-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-1">
                    <div className="w-14 h-14 rounded-md bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                      <item.icon className="w-7 h-7 text-[#1DB954]" />
                    </div>
                  </div>
                  <div className="lg:col-span-7">
                    <h3 className="text-xl font-bold text-[#111] dark:text-white mb-2">{item.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                  <div className="lg:col-span-4 bg-[#1DB954]/5 rounded-md p-4">
                    <p className="text-sm font-semibold text-[#1DB954]">
                      <span className="font-extrabold">¿Por qué importa?</span>{" "}
                      {item.why}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* DOWNGRADE COMPARISON */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-domina-compare">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <p className="text-gray-500 font-bold text-sm uppercase tracking-widest mb-4">¿No Estás Seguro?</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-domina-compare-title">
                Compara con nuestros otros planes
              </h2>
            </motion.div>

            <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="border-2 border-[#1DB954] rounded-md p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-7 h-7 text-[#1DB954]" />
                  <h3 className="text-lg font-extrabold text-[#111] dark:text-white">Plan Empieza</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6">
                  Ideal si estás empezando y solo necesitas tu primera presencia online profesional con SEO básico.
                </p>
                <Link href="/paquetes/empieza">
                  <Button variant="outline" className="w-full font-bold gap-2 border-[#1DB954] text-[#1DB954] rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-domina-ver-empieza">
                    Ver Plan Empieza
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>

              <div className="border-2 border-[#1DB954] rounded-md p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Rocket className="w-7 h-7 text-[#1DB954]" />
                  <div>
                    <h3 className="text-lg font-extrabold text-[#111] dark:text-white">Plan Crece</h3>
                    <span className="text-xs font-bold text-[#1DB954]">Más Popular</span>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-6">
                  Perfecto si quieres crecer con SEO avanzado, portafolio, reseñas y soporte por WhatsApp.
                </p>
                <Link href="/paquetes/crece">
                  <Button variant="outline" className="w-full font-bold gap-2 border-[#1DB954] text-[#1DB954] rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-domina-ver-crece">
                    Ver Plan Crece
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </motion.div>

            <div className="text-center mt-8">
              <Link href="/paquetes">
                <Button variant="outline" className="font-bold gap-2 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-domina-comparar">
                  Comparar Todos Los Planes
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SUPPORT PLAN */}
      <section className="py-16 lg:py-20 bg-[#f5f5f5] dark:bg-[#111]" data-testid="section-support-plan">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white dark:bg-[#0d0d0d] border border-gray-200 dark:border-gray-700 rounded-full px-5 py-2 mb-6 shadow-sm">
              <Shield className="w-4 h-4 text-[#1DB954]" />
              <span className="text-xs font-bold text-[#111] dark:text-white uppercase tracking-widest">Plan de Soporte y Crecimiento</span>
            </motion.div>
            <motion.p variants={fadeUp} className="text-gray-500 dark:text-gray-400 text-sm max-w-xl mx-auto mb-6">
              Para mantener tu sitio funcionando correctamente y protegido, todos los paquetes incluyen este plan mensual.
            </motion.p>
            <motion.p variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold text-[#111] dark:text-white mb-2" data-testid="text-support-price">
              $97 <span className="text-base font-semibold text-gray-400">por mes</span>
            </motion.p>
            <motion.p variants={fadeUp} className="text-gray-400 dark:text-gray-500 text-xs italic mb-8">
              Tu sitio no solo se construye. Se mantiene, se protege y evoluciona.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-gray-600 dark:text-gray-300">
              {[
                "Hosting profesional y rápido",
                "Certificado SSL de seguridad",
                "Copias de seguridad automáticas",
                "Monitoreo de seguridad",
                "Actualizaciones técnicas",
                "Optimización básica de velocidad",
                "Hasta 1 hora de cambios al mes",
                "Soporte en español",
                "Revisión básica de visibilidad en Google",
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1DB954] flex-shrink-0" />
                  {item}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* STRONG CTA */}
      <section className="py-24 lg:py-40 bg-[#111]" data-testid="section-domina-cta-bottom">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
              Los contratistas #1 no llegaron ahí por suerte. Invirtieron en marketing.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
              El Plan Domina es para quienes están listos para dejar de competir y empezar a liderar. ¿Eres tú?
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/contacto">
                <Button size="lg" className="bg-[#1DB954] text-white font-bold text-lg gap-2 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-domina-cta-bottom">
                  Quiero Dominar Mi Mercado
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="https://wa.me/1234567890?text=Hola%2C%20me%20interesa%20el%20Plan%20Domina" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-domina-whatsapp-bottom">
                  <SiWhatsapp className="w-5 h-5" />
                  Hablar por WhatsApp
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
