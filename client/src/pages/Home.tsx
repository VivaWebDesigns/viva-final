import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Star, ArrowRight, CheckCircle2, XCircle, Phone, Search, Image, MessageSquare, ChevronDown, Zap, Rocket, Crown, Eye, PhoneCall, Shield } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { motion } from "framer-motion";
import { useState } from "react";
import SEO from "@/components/SEO";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const testimonials = [
  {
    name: "Carlos Mendoza",
    business: "Mendoza Painting LLC",
    text: "Antes nadie me encontraba en Google. Ahora recibo 15-20 llamadas por semana. Viva Web Designs cambió todo para mi negocio.",
    trade: "Pintor",
  },
  {
    name: "María García",
    business: "García Landscaping",
    text: "Mi sitio web se ve increíble y mis clientes me dicen que se ve más profesional que empresas más grandes. Las llamadas no paran.",
    trade: "Jardinería",
  },
  {
    name: "Roberto Hernández",
    business: "Hernández Electric",
    text: "Invertí en Google Ads con Viva y en el primer mes recuperé 5 veces lo que gasté. Son los mejores para contratistas.",
    trade: "Electricista",
  },
];

const faqs = [
  {
    q: "¿Cuánto tiempo tarda?",
    a: "Dependiendo del paquete, tu sitio web puede estar listo en tan solo 7-14 días. Trabajamos rápido porque sabemos que cada día sin presencia online es dinero que estás dejando en la mesa.",
  },
  {
    q: "¿Necesito tener Google Business?",
    a: "No te preocupes. Si no tienes Google Business, nosotros lo creamos y configuramos por ti. Si ya lo tienes, lo optimizamos para que aparezca en las primeras posiciones del mapa local.",
  },
  {
    q: "¿Puedo pagar en partes?",
    a: "Sí. Entendemos que estás invirtiendo en tu negocio. Ofrecemos planes de pago flexibles para que puedas empezar sin presión financiera. Hablemos y encontramos la mejor opción para ti.",
  },
  {
    q: "¿Qué pasa si no tengo fotos?",
    a: "No hay problema. Podemos usar fotos profesionales de stock que se ven increíbles, o te guiamos para que tomes fotos de tu trabajo con tu teléfono. Muchos de nuestros mejores sitios empezaron así.",
  },
  {
    q: "¿Incluye soporte en español?",
    a: "Absolutamente. Todo nuestro equipo habla español. Desde la primera llamada hasta el soporte continuo, te comunicarás siempre en tu idioma. Sin barreras, sin confusiones.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-6 text-left gap-4"
        data-testid={`button-faq-${q.slice(1, 15).replace(/\s/g, "-").toLowerCase()}`}
      >
        <span className="text-lg font-bold text-[#111] dark:text-white">{q}</span>
        <ChevronDown className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="pb-6 pr-8">
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <div className="overflow-x-hidden">
      <SEO
        title="Marketing Digital para Contratistas Latinos"
        description="Creamos sitios web profesionales para contratistas latinos que quieren aparecer en Google y competir con empresas grandes. Más llamadas, más trabajos, más crecimiento."
        path="/"
      />

      {/* SECTION 1 – HERO */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden" data-testid="section-hero">
        <div className="absolute inset-0 bg-[#111]">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80')] bg-cover bg-center opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#111]/90 via-[#111]/70 to-[#111]/50" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-40">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-3xl">
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white leading-[1.1] tracking-tight mb-6" data-testid="text-hero-title">
              Más llamadas.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1DB954] to-[#22c55e]">
                Más trabajos.
              </span>{" "}
              Más crecimiento.
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-300 leading-relaxed mb-10 max-w-2xl" data-testid="text-hero-subtitle">
              Creamos sitios web profesionales para contratistas latinos que quieren aparecer en Google y competir con empresas grandes.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start gap-4">
              <Link href="/paquetes">
                <Button size="lg" className="rounded-full bg-[#1DB954] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-hero-paquetes">
                  Ver Paquetes
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="https://wa.me/1234567890?text=Hola%2C%20me%20interesa%20saber%20más%20sobre%20sus%20servicios" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="rounded-full text-white border-white/30 font-bold text-lg gap-2 bg-white/5 backdrop-blur-sm hover:shadow-lg transition-all duration-200" data-testid="button-hero-whatsapp">
                  <SiWhatsapp className="w-5 h-5" />
                  Hablar por WhatsApp
                </Button>
              </a>
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-x-5 gap-y-2 mt-6">
              {[
                "Si no tienes fotos, nosotros te ayudamos.",
                "Te respondemos rápido.",
                "Todo en español. Sin complicaciones.",
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-sm text-white/60">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  {item}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2 – PROBLEM */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-problem">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="max-w-3xl mx-auto">
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight mb-10 text-center" data-testid="text-problem-title">
              ¿Tu negocio depende solo de{" "}
              <span className="text-[#1DB954]">referencias?</span>
            </motion.h2>

            <motion.div variants={fadeUp} className="space-y-5 mb-10">
              {[
                "No apareces en Google Maps",
                "No tienes página profesional",
                "Los clientes no confían si no te encuentran online",
                "Otras compañías se ven más grandes que tú",
              ].map((item) => (
                <div key={item} className="flex items-start gap-4 p-4 rounded-md bg-red-50 dark:bg-red-950/20">
                  <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-800 dark:text-gray-200 font-medium text-lg">{item}</span>
                </div>
              ))}
            </motion.div>

            <motion.p variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold text-center text-red-500">
              Eso está costándote trabajos.
            </motion.p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link href="/paquetes">
              <Button size="lg" className="rounded-full bg-[#1DB954] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-paquetes-problem">
                Ver Paquetes
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="https://wa.me/1234567890?text=Hola%2C%20me%20interesa%20saber%20más%20sobre%20sus%20servicios" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="rounded-full text-[#111] dark:text-white border-gray-300 dark:border-gray-600 font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-whatsapp-problem">
                <SiWhatsapp className="w-5 h-5" />
                WhatsApp
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* SECTION 3 – SOLUTION POSITIONING */}
      <section className="py-24 lg:py-40 bg-[#f5f5f5] dark:bg-[#111]" data-testid="section-solution">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight mb-6" data-testid="text-solution-title">
              Te ayudamos a verte profesional y{" "}
              <span className="text-[#1DB954]">generar más llamadas.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
              No vendemos páginas web. Construimos presencia digital que genera confianza y posicionamiento local.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Image, title: "Imagen Profesional", desc: "Tu negocio se verá como las empresas grandes. Sitios web modernos que generan confianza al instante.", color: "bg-emerald-50 dark:bg-emerald-950/30", iconColor: "text-[#1DB954]" },
              { icon: Eye, title: "Visibilidad en Google", desc: "Aparece cuando tus clientes buscan servicios en tu área. SEO local y Google Maps optimizado.", color: "bg-emerald-50 dark:bg-emerald-950/30", iconColor: "text-[#1DB954]" },
              { icon: PhoneCall, title: "Más Llamadas", desc: "Todo lo que hacemos está diseñado para un resultado: que tu teléfono suene más con clientes reales.", color: "bg-emerald-50 dark:bg-emerald-950/30", iconColor: "text-[#1DB954]" },
            ].map((item) => (
              <motion.div key={item.title} variants={fadeUp} className={`p-8 lg:p-10 rounded-md ${item.color} text-center`}>
                <div className="w-16 h-16 mx-auto rounded-full bg-white dark:bg-gray-800 flex items-center justify-center mb-6">
                  <item.icon className={`w-8 h-8 ${item.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold text-[#111] dark:text-white mb-3">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link href="/paquetes">
              <Button size="lg" className="rounded-full bg-[#1DB954] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-paquetes-solution">
                Ver Paquetes
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="https://wa.me/1234567890?text=Hola%2C%20me%20interesa%20saber%20más%20sobre%20sus%20servicios" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="rounded-full text-[#111] dark:text-white border-gray-300 dark:border-gray-600 font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-whatsapp-solution">
                <SiWhatsapp className="w-5 h-5" />
                WhatsApp
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* SECTION 4 – PACKAGES PREVIEW */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-packages">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
            <motion.p variants={fadeUp} className="text-[#1DB954] font-bold text-sm uppercase tracking-widest mb-4">
              Nuestros Paquetes
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-packages-title">
              Elige Tu Plan
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10 items-end">
            {[
              {
                name: "Empieza",
                subLabel: "Base profesional",
                slug: "empieza",
                icon: Zap,
                desc: "Tu primera presencia profesional en internet para empezar a generar confianza.",
                positioning: "Para contratistas que quieren dar el primer paso con una imagen profesional.",
                price: "Desde $497",
                microcopy: "Perfecto para comenzar.",
              },
              {
                name: "Crece",
                subLabel: "La opción más elegida por contratistas que quieren crecer",
                slug: "crece",
                icon: Rocket,
                desc: "Marketing completo para recibir más llamadas y superar a tu competencia.",
                positioning: "Para negocios listos para invertir en crecimiento real y medible.",
                price: "Desde $997",
                microcopy: "Inversión inteligente para crecer.",
                popular: true,
              },
              {
                name: "Domina",
                subLabel: "Máximo posicionamiento",
                slug: "domina",
                icon: Crown,
                desc: "El paquete premium para ser la opción #1 en tu mercado local.",
                positioning: "Para líderes que quieren dominar su mercado sin dejar nada al azar.",
                price: "Desde $1,997",
                microcopy: "Construido para liderar tu mercado.",
                premium: true,
              },
            ].map((pkg) => (
              <motion.div
                key={pkg.slug}
                variants={fadeUp}
                className={`relative flex flex-col ${pkg.popular ? "md:scale-[1.06] md:z-10" : ""}`}
                data-testid={`card-package-${pkg.slug}`}
              >
                {pkg.popular && (
                  <div className="flex justify-center mb-3">
                    <span className="bg-[#1DB954] text-white text-xs font-bold px-5 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-lg" data-testid="badge-popular">
                      <Star className="w-3 h-3 fill-white" />
                      Más Popular
                    </span>
                  </div>
                )}
                <div className={`rounded-2xl border bg-white dark:bg-[#0d0d0d] flex flex-col flex-1 transition-all duration-300 ${pkg.popular ? "border-[#1DB954]/40 shadow-xl shadow-[#1DB954]/5 hover:shadow-2xl hover:shadow-[#1DB954]/10" : "border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-lg"}`}>
                  <div className="p-8 lg:p-10 text-center">
                    <div className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-5 ${pkg.popular ? "bg-[#1DB954]/10" : "bg-gray-100 dark:bg-gray-800"}`}>
                      <pkg.icon className={`w-6 h-6 ${pkg.popular ? "text-[#1DB954]" : "text-gray-500 dark:text-gray-400"}`} />
                    </div>
                    <h3 className="text-2xl font-extrabold text-[#111] dark:text-white mb-1">{pkg.name}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs leading-snug max-w-[220px] mx-auto mb-8">{pkg.subLabel}</p>

                    <div className="border-t border-gray-100 dark:border-gray-800 pt-6 pb-2">
                      <p className="text-3xl font-extrabold text-[#111] dark:text-white" data-testid={`text-price-${pkg.slug}`}>{pkg.price}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-1">Más plan mensual requerido.</p>
                      <p className="text-gray-400 dark:text-gray-500 text-xs mt-1.5 italic">{pkg.microcopy}</p>
                    </div>
                  </div>

                  <div className="px-8 lg:px-10 pb-8 lg:pb-10 flex-1 flex flex-col">
                    <p className="text-[#1DB954] text-xs font-semibold uppercase tracking-wider mb-3">{pkg.positioning}</p>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-8 flex-1 text-sm">{pkg.desc}</p>
                    <Link href={`/paquetes/${pkg.slug}`}>
                      <Button size="lg" className={`w-full rounded-full font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200 ${pkg.popular ? "bg-[#1DB954] hover:bg-[#1aa34a] text-white" : pkg.premium ? "bg-[#111] dark:bg-white text-white dark:text-[#111]" : "border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0d0d0d] text-[#111] dark:text-white hover:border-[#1DB954]"}`} data-testid={`button-ver-${pkg.slug}`}>
                        Ver Detalles
                        <ArrowRight className="w-5 h-5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 }} className="text-center text-sm text-gray-400 dark:text-gray-500 mt-8" data-testid="text-payment-reassurance">
            También ofrecemos opciones de pago en partes. <a href="https://wa.me/1234567890?text=Hola%2C%20quiero%20saber%20sobre%20opciones%20de%20pago" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1DB954] transition-colors">Pregúntanos por WhatsApp.</a>
          </motion.p>
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

      {/* SECTION 5 – BEFORE / AFTER */}
      <section className="py-24 lg:py-40 bg-[#111]" data-testid="section-before-after">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center mb-16">
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight" data-testid="text-before-after-title">
              Antes vs <span className="text-[#1DB954]">Después</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            <motion.div variants={fadeUp} className="rounded-md border border-red-500/30 bg-red-950/20 p-8 lg:p-10" data-testid="card-before">
              <div className="text-red-400 font-bold text-sm uppercase tracking-widest mb-6">Antes</div>
              <ul className="space-y-5">
                {[
                  "Sin página profesional",
                  "Pocas llamadas",
                  "Competencia dominando Google",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-lg font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div variants={fadeUp} className="rounded-md border border-[#1DB954]/30 bg-[#1DB954]/10 p-8 lg:p-10" data-testid="card-after">
              <div className="text-[#1DB954] font-bold text-sm uppercase tracking-widest mb-6">Después</div>
              <ul className="space-y-5">
                {[
                  "Imagen profesional",
                  "Más visibilidad",
                  "Más clientes llamando",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#1DB954] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-200 text-lg font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link href="/paquetes">
              <Button size="lg" className="rounded-full bg-[#1DB954] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-paquetes-beforeafter">
                Ver Paquetes
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="https://wa.me/1234567890?text=Hola%2C%20me%20interesa%20saber%20más%20sobre%20sus%20servicios" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="rounded-full text-white border-white/30 bg-white/5 font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-whatsapp-beforeafter">
                <SiWhatsapp className="w-5 h-5" />
                WhatsApp
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* SECTION 6 – HOW IT WORKS */}
      <section id="como-funciona" className="scroll-mt-20 py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-process">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
            <motion.p variants={fadeUp} className="text-[#1DB954] font-bold text-sm uppercase tracking-widest mb-4">
              Nuestro Proceso
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-process-title">
              Así Funciona
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Analizamos tu negocio", desc: "Entendemos tu mercado, tu competencia y tus metas para crear la estrategia perfecta." },
              { step: "02", title: "Construimos tu sitio profesional", desc: "Diseñamos y desarrollamos un sitio web que refleja la calidad de tu trabajo." },
              { step: "03", title: "Optimizamos para Google", desc: "SEO local, Google Maps y perfiles optimizados para que te encuentren primero." },
              { step: "04", title: "Empiezas a recibir más llamadas", desc: "Tu teléfono empieza a sonar con clientes reales que te encontraron online." },
            ].map((item) => (
              <motion.div key={item.step} variants={fadeUp} className="text-center relative">
                <div className="text-7xl font-extrabold text-gray-100 dark:text-gray-800 mb-4">{item.step}</div>
                <h3 className="text-lg font-bold text-[#111] dark:text-white mb-3">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link href="/paquetes">
              <Button size="lg" className="rounded-full bg-[#1DB954] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-paquetes-process">
                Ver Paquetes
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="https://wa.me/1234567890?text=Hola%2C%20me%20interesa%20saber%20más%20sobre%20sus%20servicios" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="rounded-full text-[#111] dark:text-white border-gray-300 dark:border-gray-600 font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-whatsapp-process">
                <SiWhatsapp className="w-5 h-5" />
                WhatsApp
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* SECTION 7 – TESTIMONIALS */}
      <section className="py-24 lg:py-40 bg-[#f5f5f5] dark:bg-[#111]" data-testid="section-testimonials">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
            <motion.p variants={fadeUp} className="text-[#1DB954] font-bold text-sm uppercase tracking-widest mb-4">
              Testimonios
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-testimonials-title">
              Lo que dicen nuestros{" "}
              <span className="text-[#1DB954]">clientes</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <motion.div key={t.name} variants={fadeUp} className="bg-white dark:bg-gray-800 rounded-md p-8" data-testid={`card-testimonial-${t.name.split(" ")[0].toLowerCase()}`}>
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1DB954] to-[#22c55e] flex items-center justify-center text-white font-bold">
                    {t.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-bold text-[#111] dark:text-white">{t.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t.business} · {t.trade}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link href="/paquetes">
              <Button size="lg" className="rounded-full bg-[#1DB954] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-paquetes-testimonials">
                Ver Paquetes
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="https://wa.me/1234567890?text=Hola%2C%20me%20interesa%20saber%20más%20sobre%20sus%20servicios" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="rounded-full text-[#111] dark:text-white border-gray-300 dark:border-gray-600 font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-whatsapp-testimonials">
                <SiWhatsapp className="w-5 h-5" />
                WhatsApp
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* SECTION 8 – FAQ */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-faq">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center mb-16">
            <motion.p variants={fadeUp} className="text-[#1DB954] font-bold text-sm uppercase tracking-widest mb-4">
              Preguntas Frecuentes
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-faq-title">
              ¿Tienes Preguntas?
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}>
            {faqs.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link href="/paquetes">
              <Button size="lg" className="rounded-full bg-[#1DB954] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-paquetes-faq">
                Ver Paquetes
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="https://wa.me/1234567890?text=Hola%2C%20me%20interesa%20saber%20más%20sobre%20sus%20servicios" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="rounded-full text-[#111] dark:text-white border-gray-300 dark:border-gray-600 font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-whatsapp-faq">
                <SiWhatsapp className="w-5 h-5" />
                WhatsApp
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* SECTION 9 – FINAL CTA */}
      <section className="py-24 lg:py-40 bg-[#111]" data-testid="section-cta">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6" data-testid="text-cta-title">
              Tu competencia ya está invirtiendo en su presencia online.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-2xl text-white/90 mb-10 font-semibold">
              ¿Vas a seguir esperando?
            </motion.p>
            <motion.div variants={fadeUp}>
              <Link href="/contacto">
                <Button size="lg" className="rounded-full bg-[#1DB954] text-white font-bold text-lg gap-2 hover:shadow-lg transition-all duration-200" data-testid="button-cta-bottom">
                  Comenzar Ahora
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
