import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Phone, Rocket, Globe, Search, MapPin, Star, BarChart3, MessageSquare } from "lucide-react";
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
  { icon: Globe, title: "Sitio Web de 5 Páginas", desc: "Sitio web completo y profesional con hasta 5 páginas optimizadas para convertir visitantes en clientes." },
  { icon: Search, title: "SEO Local Avanzado", desc: "Estrategia completa de SEO local para dominar las búsquedas en tu área. Keywords, contenido y optimización técnica." },
  { icon: MapPin, title: "Google Maps Dominante", desc: "Optimización agresiva de tu perfil de Google para aparecer en el top 3 del mapa local." },
  { icon: Star, title: "Gestión de Reseñas", desc: "Sistema automatizado para solicitar y gestionar reseñas de clientes satisfechos en Google." },
  { icon: BarChart3, title: "Google Ads Básico", desc: "Campaña de búsqueda en Google Ads optimizada para generar llamadas y cotizaciones de clientes reales." },
  { icon: MessageSquare, title: "Soporte Prioritario", desc: "Acceso directo a tu equipo de marketing por WhatsApp. Respuesta rápida cuando necesites algo." },
];

export default function PaqueteCrece() {
  return (
    <div className="overflow-x-hidden">
      <SEO
        title="Plan Crece - Más Llamadas y Más Clientes"
        description="El plan más popular para contratistas. SEO local avanzado, Google Ads, gestión de reseñas y soporte por WhatsApp desde $997/mes."
        path="/paquetes/crece"
      />

      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-gradient-to-br from-[hsl(340,82%,45%)] via-[hsl(340,82%,40%)] to-[hsl(340,82%,35%)] overflow-hidden" data-testid="section-crece-hero">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[hsl(340,82%,65%)] rounded-full blur-[180px] -translate-y-1/2 translate-x-1/4" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-3xl">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Rocket className="w-4 h-4 text-white" />
              <span className="text-sm text-white/90 font-medium">Plan Crece</span>
              <span className="bg-white text-[hsl(340,82%,45%)] text-xs font-bold px-2 py-0.5 rounded-full uppercase">Más Popular</span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" data-testid="text-crece-title">
              Más Llamadas.{" "}
              <span className="text-pink-200">Más Clientes. Más Ingresos.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-white/80 leading-relaxed mb-8 max-w-2xl">
              El plan favorito de nuestros clientes. Todo lo que necesitas para crecer de forma consistente y superar a tu competencia.
            </motion.p>
            <motion.p variants={fadeUp} className="text-4xl font-extrabold text-white mb-8">
              desde $997<span className="text-lg font-medium text-white/70">/mes</span>
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start gap-4">
              <Link href="/contacto">
                <Button size="lg" className="bg-white text-[hsl(340,82%,45%)] font-bold text-lg gap-2" data-testid="button-crece-cta">
                  Empezar a Crecer
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="tel:+1234567890">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10" data-testid="button-crece-call">
                  <Phone className="w-5 h-5" />
                  (555) 123-4567
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-white dark:bg-gray-950" data-testid="section-crece-features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
            <motion.p variants={fadeUp} className="text-[hsl(340,82%,52%)] font-bold text-sm uppercase tracking-widest mb-4">Qué Incluye</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
              Todo Para Que Tu Negocio <span className="text-[hsl(340,82%,52%)]">Crezca</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {included.map((item) => (
              <motion.div key={item.title} variants={fadeUp} className="p-8 rounded-md bg-gray-50 dark:bg-gray-900">
                <div className="w-14 h-14 rounded-md bg-pink-50 dark:bg-pink-950/30 flex items-center justify-center mb-6">
                  <item.icon className="w-7 h-7 text-[hsl(340,82%,52%)]" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-gray-50 dark:bg-gray-900" data-testid="section-crece-ideal">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.p variants={fadeUp} className="text-[hsl(340,82%,52%)] font-bold text-sm uppercase tracking-widest mb-4 text-center">Ideal Para</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight mb-8 text-center">
              ¿Es Este Plan Para Ti?
            </motion.h2>
            <motion.div variants={fadeUp} className="bg-white dark:bg-gray-800 rounded-md p-8 lg:p-10">
              <ul className="space-y-4">
                {[
                  "Ya tienes un negocio establecido pero quieres más clientes",
                  "Quieres aparecer en las primeras posiciones de Google",
                  "Necesitas un flujo constante de llamadas y cotizaciones",
                  "Tu competencia ya tiene presencia digital y te está ganando clientes",
                  "Quieres invertir en publicidad pero no sabes cómo",
                  "Necesitas gestionar y aumentar tus reseñas de Google",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[hsl(340,82%,52%)] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-gradient-to-r from-[hsl(340,82%,52%)] to-[hsl(340,82%,42%)]" data-testid="section-crece-cta-bottom">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
              Empieza a Crecer Hoy
            </motion.h2>
            <motion.p variants={fadeUp} className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
              Únete a los cientos de contratistas que ya están recibiendo más llamadas con el Plan Crece.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/contacto">
                <Button size="lg" className="bg-white text-[hsl(340,82%,45%)] font-bold text-lg gap-2" data-testid="button-crece-cta-bottom">
                  Empezar a Crecer
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/paquetes">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10" data-testid="button-crece-ver-paquetes">
                  Ver Todos Los Paquetes
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
