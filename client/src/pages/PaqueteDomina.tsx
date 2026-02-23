import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Phone, Crown, Globe, Search, BarChart3, Users, Palette, Settings, FileText, Headphones } from "lucide-react";
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
  { icon: Globe, title: "Sitio Web Ilimitado + Blog", desc: "Sitio web sin límite de páginas con blog integrado para posicionarte como experto en tu industria." },
  { icon: Search, title: "SEO Agresivo + Contenido", desc: "Estrategia SEO completa con creación de contenido mensual, artículos de blog y optimización continua." },
  { icon: BarChart3, title: "Google Ads Avanzado", desc: "Campañas avanzadas de búsqueda, display y remarketing. Optimización continua para maximizar tu retorno." },
  { icon: Users, title: "Redes Sociales Completo", desc: "Gestión total de tus redes sociales: contenido, publicaciones, historias y engagement con tu audiencia." },
  { icon: Settings, title: "Automatización y CRM", desc: "Sistema automatizado para seguimiento de leads, emails y recordatorios. Nunca pierdas un cliente potencial." },
  { icon: Palette, title: "Branding Profesional", desc: "Diseño de logo, paleta de colores, tipografía y guía de marca completa para tu negocio." },
  { icon: FileText, title: "Reportes Detallados", desc: "Reportes semanales de rendimiento con métricas clave: llamadas, visitas, conversiones y ROI." },
  { icon: Headphones, title: "Gerente Dedicado", desc: "Un gerente de cuenta dedicado que conoce tu negocio y está disponible cuando lo necesites." },
];

export default function PaqueteDomina() {
  return (
    <div className="overflow-x-hidden">
      <SEO
        title="Plan Domina - Domina Tu Mercado Local"
        description="El plan premium para contratistas que quieren ser #1 en su área. Marketing completo, redes sociales, CRM y gerente dedicado desde $1,997/mes."
        path="/paquetes/domina"
      />

      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 overflow-hidden" data-testid="section-domina-hero">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-400 rounded-full blur-[180px] -translate-y-1/2 translate-x-1/4" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-3xl">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Crown className="w-4 h-4 text-amber-200" />
              <span className="text-sm text-white/90 font-medium">Plan Domina</span>
              <span className="bg-white text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full uppercase">Premium</span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" data-testid="text-domina-title">
              Domina Tu Mercado.{" "}
              <span className="text-amber-200">Sé el #1 en Tu Área.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-white/80 leading-relaxed mb-8 max-w-2xl">
              El paquete completo para contratistas que quieren ser la opción #1 en su mercado. Marketing integral que no deja nada al azar.
            </motion.p>
            <motion.p variants={fadeUp} className="text-4xl font-extrabold text-white mb-8">
              desde $1,997<span className="text-lg font-medium text-white/70">/mes</span>
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start gap-4">
              <Link href="/contacto">
                <Button size="lg" className="bg-white text-amber-700 font-bold text-lg gap-2" data-testid="button-domina-cta">
                  Dominar Mi Mercado
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="tel:+1234567890">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10" data-testid="button-domina-call">
                  <Phone className="w-5 h-5" />
                  (555) 123-4567
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-white dark:bg-gray-950" data-testid="section-domina-features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
            <motion.p variants={fadeUp} className="text-amber-500 font-bold text-sm uppercase tracking-widest mb-4">Qué Incluye</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
              Marketing Completo Para <span className="text-amber-500">Dominar</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {included.map((item) => (
              <motion.div key={item.title} variants={fadeUp} className="p-6 rounded-md bg-gray-50 dark:bg-gray-900">
                <div className="w-12 h-12 rounded-md bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mb-5">
                  <item.icon className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-gray-50 dark:bg-gray-900" data-testid="section-domina-ideal">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.p variants={fadeUp} className="text-amber-500 font-bold text-sm uppercase tracking-widest mb-4 text-center">Ideal Para</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight mb-8 text-center">
              ¿Es Este Plan Para Ti?
            </motion.h2>
            <motion.div variants={fadeUp} className="bg-white dark:bg-gray-800 rounded-md p-8 lg:p-10">
              <ul className="space-y-4">
                {[
                  "Tienes un negocio establecido con un equipo de trabajo",
                  "Quieres ser la opción #1 en tu área y dejar atrás a la competencia",
                  "Estás listo para invertir seriamente en marketing",
                  "Necesitas presencia completa: web, SEO, ads y redes sociales",
                  "Quieres automatizar tu proceso de ventas y seguimiento",
                  "Buscas un socio de marketing, no solo un proveedor",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-gradient-to-r from-amber-500 to-amber-600" data-testid="section-domina-cta-bottom">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
              Es Hora De Dominar Tu Mercado
            </motion.h2>
            <motion.p variants={fadeUp} className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
              Deja de competir y empieza a dominar. Con el Plan Domina, tu negocio será la primera opción.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/contacto">
                <Button size="lg" className="bg-white text-amber-700 font-bold text-lg gap-2" data-testid="button-domina-cta-bottom">
                  Dominar Mi Mercado
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/paquetes">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10" data-testid="button-domina-ver-paquetes">
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
