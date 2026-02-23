import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Star, Zap, Rocket, Crown, Check, X, ChevronDown } from "lucide-react";
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

type CellValue = string | boolean;

const comparisonRows: { label: string; empieza: CellValue; crece: CellValue; domina: CellValue }[] = [
  { label: "Páginas incluidas", empieza: "1–3", crece: "Hasta 5", domina: "Ilimitadas" },
  { label: "Diseño móvil", empieza: true, crece: true, domina: true },
  { label: "WhatsApp + Click-to-call", empieza: true, crece: true, domina: true },
  { label: "Galería", empieza: false, crece: true, domina: true },
  { label: "Portafolio", empieza: false, crece: true, domina: true },
  { label: "Página de reseñas", empieza: false, crece: true, domina: true },
  { label: "Optimización para Google", empieza: "Básica", crece: "Avanzada", domina: "Agresiva" },
  { label: "Optimización por servicio", empieza: false, crece: true, domina: true },
  { label: "Estrategia de reseñas", empieza: false, crece: true, domina: true },
  { label: "Ideal para", empieza: "Empezar", crece: "Crecer", domina: "Dominar" },
];

const faqs = [
  { q: "¿Puedo cambiar de plan después?", a: "Sí. Puedes subir de plan en cualquier momento. Simplemente avísanos y ajustamos tu servicio sin complicaciones." },
  { q: "¿Hay contrato a largo plazo?", a: "No. Todos nuestros planes son mes a mes. Sin contratos largos, sin letras chicas. Te quedas porque ves resultados." },
  { q: "¿Cuánto tiempo tarda en estar listo?", a: "Dependiendo del paquete, tu sitio puede estar listo en 7-14 días. Trabajamos rápido porque cada día sin presencia online es dinero perdido." },
  { q: "¿Incluye soporte en español?", a: "Absolutamente. Todo nuestro equipo habla español. Desde la primera llamada hasta el soporte continuo, siempre en tu idioma." },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-6 text-left gap-4"
        data-testid={`button-faq-${q.slice(1, 20).replace(/\s/g, "-").toLowerCase()}`}
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

function CellDisplay({ value, highlight }: { value: CellValue; highlight?: boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className={`w-6 h-6 mx-auto ${highlight ? "text-[#1DB954]" : "text-[#1DB954]"}`} />
    ) : (
      <X className="w-6 h-6 mx-auto text-gray-300 dark:text-gray-600" />
    );
  }
  return <span className={`text-sm font-semibold ${highlight ? "text-[#1DB954]" : "text-[#111] dark:text-white"}`}>{value}</span>;
}

export default function Paquetes() {
  return (
    <div className="overflow-x-hidden">
      <SEO
        title="Paquetes de Marketing Digital para Contratistas"
        description="Elige el paquete ideal para tu negocio. Comparación completa de planes Empieza, Crece y Domina. Desde $497/mes."
        path="/paquetes"
      />

      {/* HERO */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-[#111] overflow-hidden" data-testid="section-paquetes-hero">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#1DB954] rounded-full blur-[180px] -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#1DB954] rounded-full blur-[160px] translate-y-1/3 -translate-x-1/4" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" data-testid="text-paquetes-title">
              Elige el paquete ideal para{" "}
              <span className="text-[#1DB954]">
                tu negocio
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
              Te ayudamos a verte profesional, aparecer en Google y conseguir más llamadas.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-comparison">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center mb-12">
            <motion.p variants={fadeUp} className="text-[#1DB954] font-bold text-sm uppercase tracking-widest mb-4">
              Comparación
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-comparison-title">
              ¿Qué incluye cada plan?
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeUp}>
            {/* Desktop table */}
            <div className="hidden md:block overflow-hidden rounded-md border border-gray-200 dark:border-gray-700" data-testid="table-comparison-desktop">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f5f5f5] dark:bg-[#111]">
                    <th className="text-left py-5 px-6 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[35%]"></th>
                    <th className="text-center py-5 px-4 w-[21.67%]">
                      <div className="flex flex-col items-center gap-1">
                        <Zap className="w-6 h-6 text-[#1DB954]" />
                        <span className="text-lg font-extrabold text-[#111] dark:text-white">Empieza</span>
                      </div>
                    </th>
                    <th className="text-center py-5 px-4 w-[21.67%] relative">
                      <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-[#1DB954] text-white text-[10px] font-bold px-3 py-1 rounded-b-md uppercase tracking-wider flex items-center gap-1" data-testid="badge-popular-table">
                        <Star className="w-3 h-3 fill-white" />
                        Más Popular
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Rocket className="w-6 h-6 text-[#1DB954]" />
                        <span className="text-lg font-extrabold text-[#1DB954]">Crece</span>
                      </div>
                    </th>
                    <th className="text-center py-5 px-4 w-[21.67%]">
                      <div className="flex flex-col items-center gap-1">
                        <Crown className="w-6 h-6 text-[#1DB954]" />
                        <span className="text-lg font-extrabold text-[#111] dark:text-white">Domina</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr key={row.label} className={`${i % 2 === 0 ? "bg-white dark:bg-[#0d0d0d]" : "bg-[#f5f5f5]/50 dark:bg-[#111]/50"} border-t border-gray-100 dark:border-gray-800`} data-testid={`row-comparison-${i}`}>
                      <td className="py-4 px-6 text-sm font-medium text-gray-700 dark:text-gray-300">{row.label}</td>
                      <td className="py-4 px-4 text-center"><CellDisplay value={row.empieza} /></td>
                      <td className="py-4 px-4 text-center bg-[#1DB954]/5"><CellDisplay value={row.crece} highlight /></td>
                      <td className="py-4 px-4 text-center"><CellDisplay value={row.domina} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile comparison cards */}
            <div className="md:hidden space-y-8" data-testid="table-comparison-mobile">
              {[
                { name: "Empieza", icon: Zap, color: "border-gray-200", iconColor: "text-[#1DB954]", key: "empieza" as const },
                { name: "Crece", icon: Rocket, color: "border-[#1DB954]", iconColor: "text-[#1DB954]", key: "crece" as const, popular: true },
                { name: "Domina", icon: Crown, color: "border-gray-200", iconColor: "text-[#1DB954]", key: "domina" as const },
              ].map((plan) => (
                <div key={plan.name} className={`rounded-md border-2 ${plan.color} overflow-hidden bg-white dark:bg-[#111] relative`}>
                  {plan.popular && (
                    <div className="absolute top-0 right-0 bg-[#1DB954] text-white text-[10px] font-bold px-3 py-1 rounded-bl-md uppercase tracking-wider flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      Más Popular
                    </div>
                  )}
                  <div className="p-5 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
                    <plan.icon className={`w-6 h-6 ${plan.iconColor}`} />
                    <h3 className="text-xl font-extrabold text-[#111] dark:text-white">{plan.name}</h3>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {comparisonRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between px-5 py-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">{row.label}</span>
                        <CellDisplay value={row[plan.key]} highlight={plan.popular} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* PACKAGE CARDS */}
      <section className="py-24 lg:py-40 bg-[#f5f5f5] dark:bg-[#111]" data-testid="section-paquetes-cards">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center mb-16">
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-cards-title">
              Conoce Cada Plan a Detalle
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {[
              {
                name: "Empieza",
                slug: "empieza",
                icon: Zap,
                tagline: "Tu primera presencia profesional en internet",
                price: "desde $497/mes",
                borderColor: "border-gray-200",
                iconColor: "text-[#1DB954]",
                features: [
                  "Sitio web profesional de 1–3 páginas",
                  "Diseño responsivo y moderno",
                  "Optimización SEO básica",
                  "Google Business Profile optimizado",
                  "WhatsApp + Click-to-call",
                  "Soporte por email",
                ],
              },
              {
                name: "Crece",
                slug: "crece",
                icon: Rocket,
                tagline: "Más llamadas, más clientes, más ingresos",
                price: "desde $997/mes",
                borderColor: "border-[#1DB954]",
                iconColor: "text-[#1DB954]",
                popular: true,
                features: [
                  "Todo lo del plan Empieza",
                  "Hasta 5 páginas + galería + portafolio",
                  "SEO local avanzado + Google Maps",
                  "Página de reseñas + estrategia",
                  "Optimización por servicio",
                  "Soporte prioritario por WhatsApp",
                ],
              },
              {
                name: "Domina",
                slug: "domina",
                icon: Crown,
                tagline: "Domina tu mercado y deja atrás a la competencia",
                price: "desde $1,997/mes",
                borderColor: "border-gray-200",
                iconColor: "text-[#1DB954]",
                features: [
                  "Todo lo del plan Crece",
                  "Páginas ilimitadas + blog",
                  "SEO agresivo + contenido mensual",
                  "Gestión completa de redes sociales",
                  "Automatización y CRM",
                  "Branding profesional + gerente dedicado",
                ],
              },
            ].map((pkg) => (
              <motion.div
                key={pkg.slug}
                variants={fadeUp}
                className={`relative rounded-md border-2 ${pkg.borderColor} bg-white dark:bg-[#111] flex flex-col shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] ${pkg.popular ? "ring-2 ring-[#1DB954] shadow-xl" : ""}`}
                data-testid={`card-paquete-${pkg.slug}`}
              >
                {pkg.popular && (
                  <div className="absolute top-0 right-0 bg-[#1DB954] text-white text-xs font-bold px-4 py-1.5 rounded-bl-md uppercase tracking-wider flex items-center gap-1" data-testid="badge-popular-card">
                    <Star className="w-3 h-3 fill-white" />
                    Más Popular
                  </div>
                )}

                <div className="bg-white dark:bg-[#111] p-8 border-b border-gray-100 dark:border-gray-800">
                  <div className={`w-14 h-14 rounded-md bg-[#1DB954]/10 flex items-center justify-center mb-4`}>
                    <pkg.icon className={`w-7 h-7 ${pkg.iconColor}`} />
                  </div>
                  <h3 className="text-2xl font-extrabold text-[#111] dark:text-white mb-1">{pkg.name}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{pkg.tagline}</p>
                  <p className="text-3xl font-extrabold text-[#111] dark:text-white">{pkg.price}</p>
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

                  <Link href={`/paquetes/${pkg.slug}`}>
                    <Button size="lg" className={`w-full font-bold text-lg gap-2 rounded-full ${pkg.popular ? "bg-[#1DB954] hover:bg-[#1aa34a] text-white hover:shadow-lg transition-all duration-200" : "bg-[#111] dark:bg-white text-white dark:text-[#111] hover:shadow-lg transition-all duration-200"}`} data-testid={`button-ver-${pkg.slug}`}>
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

      {/* FAQ */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-paquetes-faq">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center mb-12">
            <motion.p variants={fadeUp} className="text-[#1DB954] font-bold text-sm uppercase tracking-widest mb-4">
              Preguntas Frecuentes
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-faq-title">
              ¿Tienes Dudas?
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}>
            {faqs.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 lg:py-40 bg-[#111]" data-testid="section-paquetes-cta">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6" data-testid="text-cta-paquetes">
              ¿No sabes cuál elegir?
            </motion.h2>
            <motion.p variants={fadeUp} className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
              Escríbenos por WhatsApp y te ayudamos a elegir el plan perfecto para tu negocio.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="https://wa.me/1234567890?text=Hola%2C%20quiero%20saber%20cuál%20paquete%20es%20el%20mejor%20para%20mi%20negocio" target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-[#25D366] text-white font-bold text-lg gap-2 rounded-full hover:shadow-lg transition-all duration-200" data-testid="button-paquetes-whatsapp">
                  <SiWhatsapp className="w-5 h-5" />
                  Escríbenos por WhatsApp
                </Button>
              </a>
              <Link href="/contacto">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10 rounded-full hover:shadow-lg transition-all duration-200" data-testid="button-paquetes-contacto">
                  Enviar Mensaje
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
