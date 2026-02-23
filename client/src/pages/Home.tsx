import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Phone, Star, MapPin, TrendingUp, Shield, Users, ArrowRight, CheckCircle2, Zap, Globe, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import logoImg from "@assets/20BD1DF0-9B30-47F2-8E16-D17C4A22B42A_1771857217327.PNG";
import SEO from "@/components/SEO";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const services = [
  {
    icon: Globe,
    title: "Sitios Web Profesionales",
    desc: "Tu negocio necesita una presencia profesional en internet. Creamos sitios web que convierten visitantes en clientes.",
    color: "bg-pink-50 dark:bg-pink-950/30",
    iconColor: "text-[hsl(340,82%,52%)]",
  },
  {
    icon: MapPin,
    title: "SEO y Google Maps",
    desc: "Aparece primero cuando tus clientes buscan servicios cerca de ellos. Dominamos el SEO local para contratistas.",
    color: "bg-teal-50 dark:bg-teal-950/30",
    iconColor: "text-[hsl(160,100%,37%)]",
  },
  {
    icon: BarChart3,
    title: "Google Ads",
    desc: "Publicidad que genera llamadas reales. Campañas optimizadas para que cada dólar que inviertas regrese multiplicado.",
    color: "bg-amber-50 dark:bg-amber-950/30",
    iconColor: "text-amber-500",
  },
  {
    icon: TrendingUp,
    title: "Redes Sociales",
    desc: "Construye tu marca y conecta con tu comunidad. Contenido que muestra tu trabajo y atrae nuevos clientes.",
    color: "bg-blue-50 dark:bg-blue-950/30",
    iconColor: "text-blue-500",
  },
];

const stats = [
  { value: "500+", label: "Proyectos Completados" },
  { value: "95%", label: "Clientes Satisfechos" },
  { value: "3x", label: "Más Llamadas en Promedio" },
  { value: "50+", label: "Ciudades Servidas" },
];

const testimonials = [
  {
    name: "Carlos Mendoza",
    business: "Mendoza Painting LLC",
    text: "Antes nadie me encontraba en Google. Ahora recibo 15-20 llamadas por semana. Viva Web Designs cambió todo para mi negocio.",
    trade: "Pintor",
    stars: 5,
  },
  {
    name: "María García",
    business: "García Landscaping",
    text: "Mi sitio web se ve increíble y mis clientes me dicen que se ve más profesional que empresas más grandes. Las llamadas no paran.",
    trade: "Jardinería",
    stars: 5,
  },
  {
    name: "Roberto Hernández",
    business: "Hernández Electric",
    text: "Invertí en Google Ads con Viva y en el primer mes recuperé 5 veces lo que gasté. Son los mejores para contratistas.",
    trade: "Electricista",
    stars: 5,
  },
];

const trustedTrades = [
  "Pintores", "Electricistas", "Paisajistas", "Framers", "Instaladores de Vidrio",
  "Plomeros", "Techadores", "HVAC", "Carpinteros", "Albañiles",
];

export default function Home() {
  return (
    <div className="overflow-x-hidden">
      <SEO
        title="Marketing Digital para Contratistas Latinos"
        description="Ayudamos a contratistas latinos a conseguir más llamadas, aparecer en Google Maps y competir con las empresas más grandes. Diseño web, SEO y marketing digital."
        path="/"
      />
      <section className="relative min-h-[90vh] flex items-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 overflow-hidden" data-testid="section-hero">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[hsl(340,82%,52%)] rounded-full blur-[180px] -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[hsl(160,100%,37%)] rounded-full blur-[160px] translate-y-1/3 -translate-x-1/4" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-40">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="max-w-3xl"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-8">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-gray-300 font-medium">Marketing diseñado para contratistas latinos</span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white leading-[1.1] tracking-tight mb-6" data-testid="text-hero-title">
              Más Llamadas.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(340,82%,60%)] to-[hsl(340,82%,45%)]">
                Más Clientes.
              </span>{" "}
              Más Crecimiento.
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-300 leading-relaxed mb-10 max-w-2xl" data-testid="text-hero-subtitle">
              Ayudamos a contratistas latinos a aparecer en Google, conseguir más llamadas y competir con las empresas más grandes.{" "}
              <span className="text-white font-semibold">Sin complicaciones. Sin jerga. Solo resultados.</span>
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start gap-4">
              <Link href="/contacto">
                <Button size="lg" className="bg-[hsl(340,82%,52%)] text-white font-bold text-lg gap-2" data-testid="button-hero-cta">
                  Pide Tu Cotización Gratis
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="tel:+1234567890">
                <Button size="lg" variant="outline" className="text-white border-white/30 font-bold text-lg gap-2 bg-white/5 backdrop-blur-sm" data-testid="button-hero-call">
                  <Phone className="w-5 h-5" />
                  Llámanos Ahora
                </Button>
              </a>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-12 flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-teal-400 border-2 border-gray-900 flex items-center justify-center text-white text-xs font-bold">
                      {["CM", "MG", "RH", "JL"][i - 1]}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">500+ contratistas confían en nosotros</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-6 bg-[hsl(340,82%,52%)]" data-testid="section-trades-bar">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {trustedTrades.map((trade) => (
              <span key={trade} className="text-white/90 text-sm font-semibold uppercase tracking-wider">
                {trade}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-white dark:bg-gray-950" data-testid="section-problem">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <motion.p variants={fadeUp} className="text-[hsl(340,82%,52%)] font-bold text-sm uppercase tracking-widest mb-4">
              El Problema
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight mb-6" data-testid="text-problem-title">
              Tu Trabajo es Excelente.{" "}
              <span className="text-[hsl(160,100%,37%)]">Pero Nadie Te Encuentra.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
              Haces un trabajo increíble, pero las empresas más grandes dominan Google porque tienen marketing profesional. Nosotros nivelamos el campo de juego.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {[
              {
                icon: Shield,
                title: "No apareces en Google",
                desc: "Tus clientes buscan servicios todos los días, pero encuentran a tu competencia primero.",
              },
              {
                icon: Users,
                title: "No tienes sitio web profesional",
                desc: "Un perfil de Facebook no es suficiente. Necesitas una presencia que genere confianza.",
              },
              {
                icon: TrendingUp,
                title: "Pierdes clientes cada día",
                desc: "Cada día sin marketing digital son llamadas que van a otro contratista.",
              },
            ].map((item) => (
              <motion.div
                key={item.title}
                variants={fadeUp}
                className="text-center p-8 rounded-md bg-gray-50 dark:bg-gray-900"
              >
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
                  <item.icon className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-gray-50 dark:bg-gray-900" data-testid="section-services">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <motion.p variants={fadeUp} className="text-[hsl(340,82%,52%)] font-bold text-sm uppercase tracking-widest mb-4">
              Nuestros Servicios
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight mb-6" data-testid="text-services-title">
              Todo Lo Que Necesitas Para{" "}
              <span className="text-[hsl(340,82%,52%)]">Dominar Tu Mercado</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
              Servicios de marketing digital diseñados específicamente para contratistas latinos.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {services.map((service) => (
              <motion.div
                key={service.title}
                variants={fadeUp}
                className={`p-8 lg:p-10 rounded-md ${service.color} group`}
              >
                <div className="w-14 h-14 rounded-md bg-white dark:bg-gray-800 flex items-center justify-center mb-6">
                  <service.icon className={`w-7 h-7 ${service.iconColor}`} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{service.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">{service.desc}</p>
                <Link href="/paquetes" className="inline-flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white" data-testid={`link-service-${service.title.split(" ")[0].toLowerCase()}`}>
                  Más Información
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </motion.div>
            ))}
          </motion.div>

          <div className="text-center mt-12">
            <Link href="/paquetes">
              <Button size="lg" className="bg-[hsl(340,82%,52%)] text-white font-bold text-lg gap-2" data-testid="button-all-services">
                Ver Nuestros Paquetes
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-gray-950" data-testid="section-stats">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12"
          >
            {stats.map((stat) => (
              <motion.div key={stat.label} variants={fadeUp} className="text-center">
                <p className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[hsl(340,82%,60%)] to-[hsl(160,100%,45%)] mb-2">
                  {stat.value}
                </p>
                <p className="text-gray-400 text-sm sm:text-base font-medium">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-white dark:bg-gray-950" data-testid="section-why-us">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
          >
            <motion.div variants={fadeUp}>
              <p className="text-[hsl(340,82%,52%)] font-bold text-sm uppercase tracking-widest mb-4">
                Por Qué Elegirnos
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight mb-6" data-testid="text-why-title">
                Entendemos Tu Negocio Porque{" "}
                <span className="text-[hsl(160,100%,37%)]">Somos Como Tú</span>
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-8">
                No somos una agencia genérica. Nos especializamos en contratistas latinos. Hablamos tu idioma, entendemos tu cultura y sabemos exactamente lo que necesitas para crecer.
              </p>
              <ul className="space-y-4">
                {[
                  "Hablamos español, sin barreras de comunicación",
                  "Expertos en marketing para contratistas",
                  "Resultados medibles, no promesas vacías",
                  "Precios justos diseñados para negocios pequeños",
                  "Soporte personalizado, no un número más",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[hsl(160,100%,37%)] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div variants={fadeUp} className="relative">
              <div className="bg-gradient-to-br from-[hsl(340,82%,52%)] to-[hsl(160,100%,37%)] rounded-md p-1">
                <div className="bg-white dark:bg-gray-900 rounded-md p-8 lg:p-10">
                  <div className="text-center mb-8">
                    <img src={logoImg} alt="Viva Web Designs" className="h-16 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">La Diferencia Viva</h3>
                  </div>
                  <div className="space-y-6">
                    {[
                      { label: "Comunicación", value: "100% en Español" },
                      { label: "Enfoque", value: "Solo Contratistas" },
                      { label: "Resultados", value: "Garantizados" },
                      { label: "Contrato", value: "Sin Contratos Largos" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">{item.label}</span>
                        <span className="text-[hsl(160,100%,37%)] font-bold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-gray-50 dark:bg-gray-900" data-testid="section-testimonials">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <motion.p variants={fadeUp} className="text-[hsl(340,82%,52%)] font-bold text-sm uppercase tracking-widest mb-4">
              Testimonios
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight" data-testid="text-testimonials-title">
              Lo Que Dicen Nuestros{" "}
              <span className="text-[hsl(340,82%,52%)]">Clientes</span>
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {testimonials.map((t) => (
              <motion.div
                key={t.name}
                variants={fadeUp}
                className="bg-white dark:bg-gray-800 rounded-md p-8 relative"
                data-testid={`card-testimonial-${t.name.split(" ")[0].toLowerCase()}`}
              >
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6 italic">
                  "{t.text}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(340,82%,52%)] to-[hsl(160,100%,37%)] flex items-center justify-center text-white font-bold">
                    {t.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">{t.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t.business} · {t.trade}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-white dark:bg-gray-950" data-testid="section-process">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <motion.p variants={fadeUp} className="text-[hsl(340,82%,52%)] font-bold text-sm uppercase tracking-widest mb-4">
              Nuestro Proceso
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight" data-testid="text-process-title">
              Así de Fácil Es{" "}
              <span className="text-[hsl(160,100%,37%)]">Empezar</span>
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {[
              {
                step: "01",
                title: "Llámanos o Escríbenos",
                desc: "Cuéntanos sobre tu negocio y tus metas. La consulta es 100% gratis y sin compromiso.",
              },
              {
                step: "02",
                title: "Creamos Tu Plan",
                desc: "Diseñamos una estrategia personalizada para tu negocio y presupuesto. Tú apruebas todo antes de empezar.",
              },
              {
                step: "03",
                title: "Tu Negocio Crece",
                desc: "Lanzamos tu marketing y empiezas a recibir más llamadas, más clientes y más ingresos.",
              },
            ].map((item) => (
              <motion.div key={item.step} variants={fadeUp} className="text-center relative">
                <div className="text-7xl font-extrabold text-gray-100 dark:text-gray-800 mb-4">{item.step}</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-gradient-to-r from-[hsl(340,82%,52%)] to-[hsl(340,82%,42%)]" data-testid="section-cta">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6" data-testid="text-cta-title">
              ¿Listo Para Que Tu Negocio Crezca?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
              Únete a los cientos de contratistas latinos que ya están dominando su mercado con Viva Web Designs.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/contacto">
                <Button size="lg" className="bg-white text-[hsl(340,82%,52%)] font-bold text-lg gap-2" data-testid="button-cta-bottom">
                  Pide Tu Cotización Gratis
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="tel:+1234567890">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10" data-testid="button-call-bottom">
                  <Phone className="w-5 h-5" />
                  (555) 123-4567
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
