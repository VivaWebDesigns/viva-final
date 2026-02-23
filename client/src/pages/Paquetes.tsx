import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Star, Zap, Rocket, Crown, Phone } from "lucide-react";
import { motion } from "framer-motion";
import SEO from "@/components/SEO";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.15 } },
};

const packages = [
  {
    name: "Empieza",
    slug: "empieza",
    icon: Zap,
    tagline: "Tu primera presencia profesional en internet",
    price: "desde $497/mes",
    color: "from-[hsl(160,100%,37%)] to-[hsl(160,100%,28%)]",
    borderColor: "border-[hsl(160,100%,37%)]",
    iconBg: "bg-teal-50 dark:bg-teal-950/30",
    iconColor: "text-[hsl(160,100%,37%)]",
    features: [
      "Sitio web profesional de 1-3 páginas",
      "Diseño responsivo y moderno",
      "Optimización SEO básica",
      "Perfil de Google Business optimizado",
      "Formulario de contacto funcional",
      "Soporte por email",
    ],
    ideal: "Contratistas que están empezando y necesitan una presencia profesional básica.",
  },
  {
    name: "Crece",
    slug: "crece",
    icon: Rocket,
    tagline: "Más llamadas, más clientes, más ingresos",
    price: "desde $997/mes",
    color: "from-[hsl(340,82%,52%)] to-[hsl(340,82%,42%)]",
    borderColor: "border-[hsl(340,82%,52%)]",
    iconBg: "bg-pink-50 dark:bg-pink-950/30",
    iconColor: "text-[hsl(340,82%,52%)]",
    popular: true,
    features: [
      "Todo lo del plan Empieza",
      "Sitio web de hasta 5 páginas",
      "SEO local avanzado + Google Maps",
      "Gestión de reseñas de Google",
      "Campaña de Google Ads básica",
      "Reportes mensuales de rendimiento",
      "Soporte prioritario por WhatsApp",
    ],
    ideal: "Contratistas que ya tienen trabajo pero quieren crecer y recibir más llamadas de forma consistente.",
  },
  {
    name: "Domina",
    slug: "domina",
    icon: Crown,
    tagline: "Domina tu mercado y deja atrás a la competencia",
    price: "desde $1,997/mes",
    color: "from-amber-500 to-amber-600",
    borderColor: "border-amber-500",
    iconBg: "bg-amber-50 dark:bg-amber-950/30",
    iconColor: "text-amber-500",
    features: [
      "Todo lo del plan Crece",
      "Sitio web ilimitado con blog",
      "SEO agresivo + contenido mensual",
      "Campañas avanzadas de Google Ads",
      "Gestión completa de redes sociales",
      "Automatización y CRM",
      "Branding profesional y logo",
      "Gerente de cuenta dedicado",
    ],
    ideal: "Contratistas establecidos que quieren dominar su mercado y convertirse en la opción #1 en su área.",
  },
];

export default function Paquetes() {
  return (
    <div className="overflow-x-hidden">
      <SEO
        title="Paquetes de Marketing Digital para Contratistas"
        description="Elige el plan perfecto para tu negocio. Desde presencia básica hasta dominación total del mercado. Planes desde $497/mes."
        path="/paquetes"
      />

      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 overflow-hidden" data-testid="section-paquetes-hero">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[hsl(340,82%,52%)] rounded-full blur-[180px] -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[hsl(160,100%,37%)] rounded-full blur-[160px] translate-y-1/3 -translate-x-1/4" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.p variants={fadeUp} className="text-[hsl(340,82%,60%)] font-bold text-sm uppercase tracking-widest mb-4">
              Nuestros Paquetes
            </motion.p>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" data-testid="text-paquetes-title">
              El Plan Perfecto Para{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(340,82%,60%)] to-[hsl(160,100%,45%)]">
                Tu Negocio
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
              Sin contratos largos. Sin letras chicas. Solo resultados reales para tu negocio de contratista.
            </motion.p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-white dark:bg-gray-950" data-testid="section-paquetes-grid">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {packages.map((pkg) => (
              <motion.div
                key={pkg.slug}
                variants={fadeUp}
                className={`relative rounded-md border-2 ${pkg.borderColor} bg-white dark:bg-gray-900 overflow-hidden flex flex-col`}
                data-testid={`card-paquete-${pkg.slug}`}
              >
                {pkg.popular && (
                  <div className="absolute top-0 right-0 bg-[hsl(340,82%,52%)] text-white text-xs font-bold px-4 py-1.5 rounded-bl-md uppercase tracking-wider flex items-center gap-1" data-testid="badge-popular">
                    <Star className="w-3 h-3 fill-white" />
                    Más Popular
                  </div>
                )}

                <div className={`bg-gradient-to-r ${pkg.color} p-8`}>
                  <div className="w-14 h-14 rounded-md bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4">
                    <pkg.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-extrabold text-white mb-1">{pkg.name}</h3>
                  <p className="text-white/80 text-sm mb-4">{pkg.tagline}</p>
                  <p className="text-3xl font-extrabold text-white">{pkg.price}</p>
                </div>

                <div className="p-8 flex-1 flex flex-col">
                  <ul className="space-y-3 mb-8 flex-1">
                    {pkg.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <CheckCircle2 className={`w-5 h-5 ${pkg.iconColor} flex-shrink-0 mt-0.5`} />
                        <span className="text-gray-700 dark:text-gray-300 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 italic">
                    {pkg.ideal}
                  </p>

                  <Link href={`/paquetes/${pkg.slug}`}>
                    <Button size="lg" className={`w-full font-bold text-lg gap-2 ${pkg.popular ? "bg-[hsl(340,82%,52%)] text-white" : "bg-gray-900 dark:bg-white text-white dark:text-gray-900"}`} data-testid={`button-ver-${pkg.slug}`}>
                      Ver Detalles
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-gradient-to-r from-[hsl(340,82%,52%)] to-[hsl(340,82%,42%)]" data-testid="section-paquetes-cta">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
              ¿No Sabes Cuál Elegir?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
              Agenda una llamada gratis y te ayudamos a elegir el plan perfecto para tu negocio y presupuesto.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/contacto">
                <Button size="lg" className="bg-white text-[hsl(340,82%,45%)] font-bold text-lg gap-2" data-testid="button-paquetes-contacto">
                  Agenda Tu Llamada Gratis
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="tel:+1234567890">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10" data-testid="button-paquetes-call">
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
