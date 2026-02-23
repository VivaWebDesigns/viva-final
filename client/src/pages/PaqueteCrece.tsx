import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Rocket, Globe, Search, MapPin, Star, BarChart3, MessageSquare, Phone, Image, FileText, Crown, Shield } from "lucide-react";
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
    title: "Sitio Web Completo (Hasta 5 Páginas)",
    desc: "Un sitio web profesional con páginas dedicadas para cada servicio que ofreces. Tus clientes encontrarán exactamente lo que buscan — y te llamarán.",
    why: "Más páginas = más oportunidades de aparecer en Google para diferentes búsquedas.",
  },
  {
    icon: Image,
    title: "Galería + Portafolio de Trabajo",
    desc: "Muestra tu mejor trabajo con fotos profesionales organizadas por proyecto. Tus clientes podrán ver la calidad de lo que haces antes de llamarte.",
    why: "Los clientes quieren ver tu trabajo. Un portafolio convierte curiosos en llamadas.",
  },
  {
    icon: Star,
    title: "Página de Reseñas + Estrategia",
    desc: "Página dedicada a mostrar tus mejores reseñas de Google, más un sistema automatizado para pedirle a tus clientes que te dejen una reseña después de cada trabajo.",
    why: "Las reseñas son la prueba social más poderosa. Más reseñas = más confianza = más llamadas.",
  },
  {
    icon: Search,
    title: "SEO Local Avanzado",
    desc: "Estrategia completa de SEO local: investigación de palabras clave, optimización por cada servicio que ofreces, contenido optimizado y estructura técnica para dominar tu área.",
    why: "El SEO avanzado te pone donde el básico no llega — en las primeras posiciones de Google.",
  },
  {
    icon: MapPin,
    title: "Google Maps Optimizado",
    desc: "Optimización agresiva de tu perfil de Google para aparecer en el top 3 del mapa local. Categorías, fotos, publicaciones y respuestas a reseñas.",
    why: "El 46% de las búsquedas en Google son locales. Si no estás en el mapa, no existes.",
  },
  {
    icon: FileText,
    title: "Optimización por Servicio",
    desc: "Cada servicio que ofreces tiene su propia página optimizada. Si haces pintura, drywall y stucco, tendrás una página enfocada en cada uno para captar más búsquedas.",
    why: "Una página por servicio multiplica tus oportunidades de aparecer en Google.",
  },
  {
    icon: Phone,
    title: "WhatsApp + Click-to-Call + Formulario",
    desc: "Múltiples formas para que te contacten: WhatsApp, llamada directa y formulario de cotización. Cada botón visible y listo para generar un lead.",
    why: "Cada cliente tiene su forma preferida de contactarte. Dale todas las opciones.",
  },
  {
    icon: MessageSquare,
    title: "Soporte Prioritario por WhatsApp",
    desc: "Acceso directo a tu equipo de marketing por WhatsApp. Respuestas rápidas, cambios ágiles y comunicación sin barreras.",
    why: "Cuando necesites algo, no vas a esperar 48 horas por un email. Te respondemos rápido.",
  },
];

export default function PaqueteCrece() {
  return (
    <div className="overflow-x-hidden">
      <SEO
        title="Plan Crece - Más Llamadas, Más Clientes, Más Ingresos"
        description="El plan más popular para contratistas. SEO avanzado, galería de trabajo, estrategia de reseñas, optimización por servicio y soporte por WhatsApp desde $997/mes."
        path="/paquetes/crece"
      />

      {/* HERO */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-[#111] overflow-hidden" data-testid="section-crece-hero">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#1DB954] rounded-full blur-[180px] -translate-y-1/2 translate-x-1/4" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-3xl">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Rocket className="w-4 h-4 text-white" />
              <span className="text-sm text-white/90 font-medium">Plan Crece</span>
              <span className="bg-white text-[#1DB954] text-xs font-bold px-2 py-0.5 rounded-full uppercase">Más Popular</span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" data-testid="text-crece-title">
              Deja de esperar que te recomienden.{" "}
              <span className="text-emerald-200">Haz que te encuentren.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-white/80 leading-relaxed mb-8 max-w-2xl">
              El plan favorito de nuestros clientes. Todo lo que necesitas para aparecer en Google, generar confianza y recibir un flujo constante de llamadas.
            </motion.p>
            <motion.p variants={fadeUp} className="text-4xl font-extrabold text-white mb-2">
              desde $997
            </motion.p>
            <motion.p variants={fadeUp} className="text-xs text-white/60 font-medium mb-8">Más plan mensual requerido.</p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start gap-4">
              <Link href="/contacto">
                <Button size="lg" className="bg-[#1DB954] text-white font-bold text-lg gap-2 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-crece-cta">
                  Quiero Crecer
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="https://wa.me/1234567890?text=Hola%2C%20me%20interesa%20el%20Plan%20Crece" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-crece-whatsapp">
                  <SiWhatsapp className="w-5 h-5" />
                  Hablar por WhatsApp
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-crece-ideal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp}>
              <p className="text-[#1DB954] font-bold text-sm uppercase tracking-widest mb-4">¿Para Quién Es?</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111] dark:text-white leading-tight mb-6" data-testid="text-crece-ideal-title">
                Este plan es para ti si...
              </h2>
              <ul className="space-y-4">
                {[
                  "Ya tienes un negocio pero quieres más clientes de forma consistente",
                  "Tu competencia aparece en Google y tú no — y estás cansado de eso",
                  "Sabes que tu trabajo es bueno pero necesitas que más gente lo vea",
                  "Quieres mostrar tu portafolio y tus reseñas para generar confianza",
                  "Necesitas aparecer cuando alguien busca tu servicio en tu área",
                  "Estás listo para invertir en crecer y no solo sobrevivir",
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
                  <Star className="w-5 h-5 text-[#1DB954] fill-[#1DB954]" />
                  <span className="text-sm font-bold text-[#1DB954] uppercase tracking-wider">Más Popular</span>
                </div>
                <Rocket className="w-16 h-16 text-[#1DB954] mx-auto mb-6" />
                <h3 className="text-2xl font-extrabold text-[#111] dark:text-white mb-3">Plan Crece</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">El favorito de contratistas serios</p>
                <p className="text-5xl font-extrabold text-[#1DB954] mb-1">$997</p>
                <p className="text-[10px] text-gray-400 font-medium mb-4">Más plan mensual requerido.</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* WHAT'S INCLUDED — BENEFIT DRIVEN */}
      <section className="py-24 lg:py-40 bg-[#f5f5f5] dark:bg-[#111]" data-testid="section-crece-features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
            <motion.p variants={fadeUp} className="text-[#1DB954] font-bold text-sm uppercase tracking-widest mb-4">Qué Incluye</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-crece-features-title">
              Todo Para Que Tu Negocio <span className="text-[#1DB954]">Crezca de Verdad</span>
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

      {/* UPGRADE COMPARISON */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-crece-upgrade">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <p className="text-[#1DB954] font-bold text-sm uppercase tracking-widest mb-4">¿Quieres Más Poder?</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-crece-upgrade-title">
                Si quieres dominar tu mercado, el <span className="text-[#1DB954]">Plan Domina</span> es tu siguiente paso
              </h2>
            </motion.div>

            <motion.div variants={fadeUp} className="border-2 border-[#1DB954] rounded-md p-1">
              <div className="bg-white dark:bg-[#111] rounded-md p-8 lg:p-10">
                <div className="flex items-center gap-3 mb-6">
                  <Crown className="w-8 h-8 text-[#1DB954]" />
                  <div>
                    <h3 className="text-xl font-extrabold text-[#111] dark:text-white">Plan Domina</h3>
                    <span className="text-sm font-bold text-[#1DB954] uppercase tracking-wider">Premium</span>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                  Todo lo del Plan Crece más: páginas ilimitadas con blog, SEO agresivo con contenido mensual, campañas avanzadas de Google Ads, gestión completa de redes sociales, automatización y CRM, branding profesional y un gerente de cuenta dedicado.
                </p>
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <Link href="/paquetes/domina">
                    <Button size="lg" className="bg-[#1DB954] text-white font-bold text-lg gap-2 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-crece-ver-domina">
                      Ver Plan Domina
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="/paquetes">
                    <Button size="lg" variant="outline" className="font-bold text-lg gap-2 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-crece-comparar">
                      Comparar Todos Los Planes
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
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
      <section className="py-24 lg:py-40 bg-[#111]" data-testid="section-crece-cta-bottom">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
              Tu competencia está creciendo. ¿Y tú?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
              Cada semana que esperas, son llamadas que se van a otro contratista. El Plan Crece está diseñado para cambiar eso.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/contacto">
                <Button size="lg" className="bg-[#1DB954] text-white font-bold text-lg gap-2 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-crece-cta-bottom">
                  Quiero Crecer Hoy
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="https://wa.me/1234567890?text=Hola%2C%20me%20interesa%20el%20Plan%20Crece" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-crece-whatsapp-bottom">
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
