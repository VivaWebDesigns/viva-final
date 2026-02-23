import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Globe, MapPin, BarChart3, TrendingUp, Palette, Smartphone, ArrowRight, CheckCircle2, Phone } from "lucide-react";
import { motion } from "framer-motion";
import SEO from "@/components/SEO";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const allServices = [
  {
    icon: Globe,
    title: "Sitios Web Profesionales",
    desc: "Tu sitio web es la primera impresión que tus clientes tienen de tu negocio. Creamos sitios web modernos, rápidos y optimizados para convertir visitantes en llamadas.",
    features: [
      "Diseño moderno y profesional",
      "Optimizado para celulares",
      "Formulario de contacto integrado",
      "Carga rápida en 2 segundos",
      "Galería de trabajos",
      "Conectado a Google Analytics",
    ],
    color: "from-pink-500 to-rose-600",
    bgColor: "bg-pink-50 dark:bg-pink-950/20",
    iconColor: "text-[hsl(340,82%,52%)]",
  },
  {
    icon: MapPin,
    title: "SEO y Google Maps",
    desc: "Cuando alguien busca 'pintor cerca de mí' o 'electricista en [tu ciudad]', tu negocio aparece primero. Dominamos el SEO local para que te encuentren.",
    features: [
      "Optimización Google My Business",
      "SEO local para tu ciudad",
      "Palabras clave de tu industria",
      "Más reseñas de 5 estrellas",
      "Reportes mensuales de posición",
      "Estrategia de contenido local",
    ],
    color: "from-teal-500 to-emerald-600",
    bgColor: "bg-teal-50 dark:bg-teal-950/20",
    iconColor: "text-[hsl(160,100%,37%)]",
  },
  {
    icon: BarChart3,
    title: "Google Ads",
    desc: "Publicidad de pago que genera llamadas inmediatas. Nuestras campañas están optimizadas para contratistas y cada dólar está diseñado para generar retorno.",
    features: [
      "Campañas de búsqueda local",
      "Anuncios de llamada directa",
      "Seguimiento de conversiones",
      "Optimización semanal",
      "Presupuesto controlado",
      "Reportes de rendimiento",
    ],
    color: "from-amber-500 to-orange-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
    iconColor: "text-amber-500",
  },
  {
    icon: TrendingUp,
    title: "Redes Sociales",
    desc: "Construye tu marca, muestra tu trabajo y conecta con tu comunidad. Gestionamos tus redes para que tu negocio tenga presencia profesional constante.",
    features: [
      "Facebook e Instagram",
      "Publicaciones semanales",
      "Fotos de antes y después",
      "Historias y Reels",
      "Respuesta a comentarios",
      "Estrategia de contenido",
    ],
    color: "from-blue-500 to-indigo-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    iconColor: "text-blue-500",
  },
  {
    icon: Palette,
    title: "Branding y Logo",
    desc: "Tu marca es tu identidad. Creamos logos profesionales, tarjetas de presentación y materiales que hacen que tu negocio se vea grande y confiable.",
    features: [
      "Diseño de logo profesional",
      "Tarjetas de presentación",
      "Diseño para vehículos",
      "Uniformes y camisetas",
      "Papelería comercial",
      "Guía de marca",
    ],
    color: "from-purple-500 to-violet-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
    iconColor: "text-purple-500",
  },
  {
    icon: Smartphone,
    title: "Automatización y CRM",
    desc: "No pierdas más llamadas. Configuramos sistemas que responden automáticamente, dan seguimiento a clientes y organizan tu negocio.",
    features: [
      "Respuesta automática 24/7",
      "Seguimiento de clientes",
      "Recordatorios de citas",
      "Chat en tu sitio web",
      "Integración con WhatsApp",
      "Panel de control simple",
    ],
    color: "from-cyan-500 to-teal-600",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/20",
    iconColor: "text-cyan-500",
  },
];

export default function Servicios() {
  return (
    <div>
      <SEO
        title="Servicios de Marketing Digital"
        description="Sitios web, SEO, Google Ads, redes sociales, branding y automatización. Servicios de marketing digital diseñados para contratistas latinos."
        path="/servicios"
      />
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 overflow-hidden" data-testid="section-servicios-hero">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-0 left-1/2 w-[600px] h-[600px] bg-[hsl(340,82%,52%)] rounded-full blur-[180px] -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.p variants={fadeUp} className="text-[hsl(340,82%,60%)] font-bold text-sm uppercase tracking-widest mb-4">
              Nuestros Servicios
            </motion.p>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" data-testid="text-servicios-title">
              Soluciones Completas Para{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(340,82%,60%)] to-[hsl(160,100%,45%)]">
                Hacer Crecer Tu Negocio
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
              Cada servicio está diseñado específicamente para contratistas latinos. Escoge lo que necesitas o déjanos crear un plan completo para ti.
            </motion.p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-white dark:bg-gray-950" data-testid="section-servicios-list">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-20 lg:space-y-32">
            {allServices.map((service, idx) => (
              <motion.div
                key={service.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={stagger}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center ${
                  idx % 2 === 1 ? "lg:direction-rtl" : ""
                }`}
                data-testid={`section-service-${idx}`}
              >
                <motion.div variants={fadeUp} className={idx % 2 === 1 ? "lg:order-2" : ""}>
                  <div className={`w-14 h-14 rounded-md ${service.bgColor} flex items-center justify-center mb-6`}>
                    <service.icon className={`w-7 h-7 ${service.iconColor}`} />
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight mb-4">
                    {service.title}
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-8">
                    {service.desc}
                  </p>
                  <Link href="/contacto">
                    <Button className="bg-[hsl(340,82%,52%)] text-white font-bold gap-2" data-testid={`button-service-cta-${idx}`}>
                      Empieza Ahora
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </motion.div>

                <motion.div variants={fadeUp} className={idx % 2 === 1 ? "lg:order-1" : ""}>
                  <div className={`${service.bgColor} rounded-md p-8 lg:p-10`}>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Lo Que Incluye:</h3>
                    <ul className="space-y-4">
                      {service.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <CheckCircle2 className={`w-5 h-5 ${service.iconColor} flex-shrink-0 mt-0.5`} />
                          <span className="text-gray-700 dark:text-gray-300 font-medium">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-gradient-to-r from-[hsl(340,82%,52%)] to-[hsl(340,82%,42%)]" data-testid="section-servicios-cta">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
            ¿No Sabes Qué Servicio Necesitas?
          </h2>
          <p className="text-xl text-white/90 mb-10">
            No te preocupes. Llámanos y te ayudamos a encontrar el plan perfecto para tu negocio. La consulta es gratis.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/contacto">
              <Button size="lg" className="bg-white text-[hsl(340,82%,52%)] font-bold text-lg gap-2" data-testid="button-servicios-consult">
                Consulta Gratuita
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="tel:+1234567890">
              <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10" data-testid="button-servicios-call">
                <Phone className="w-5 h-5" />
                (555) 123-4567
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
