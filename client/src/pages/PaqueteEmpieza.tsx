import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Phone, Zap, Globe, Search, FileText, MessageSquare, Shield } from "lucide-react";
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
  { icon: Globe, title: "Sitio Web Profesional", desc: "1-3 páginas con diseño moderno, responsivo y optimizado para móviles. Tu negocio se verá profesional." },
  { icon: Search, title: "SEO Básico", desc: "Optimización fundamental para que Google entienda tu negocio y empiece a mostrarte en resultados locales." },
  { icon: FileText, title: "Google Business Profile", desc: "Configuración y optimización de tu perfil de Google para aparecer en Google Maps y búsquedas locales." },
  { icon: MessageSquare, title: "Formulario de Contacto", desc: "Formulario funcional para que tus clientes potenciales te contacten directamente desde tu sitio web." },
  { icon: Shield, title: "Hosting y SSL Incluido", desc: "Tu sitio web siempre en línea, rápido y seguro con certificado SSL sin costo adicional." },
  { icon: Zap, title: "Soporte por Email", desc: "Equipo de soporte disponible por email para resolver cualquier duda o problema con tu sitio." },
];

export default function PaqueteEmpieza() {
  return (
    <div className="overflow-x-hidden">
      <SEO
        title="Plan Empieza - Tu Primera Presencia Digital"
        description="El plan perfecto para contratistas que están empezando. Sitio web profesional, SEO básico y Google Business Profile desde $497/mes."
        path="/paquetes/empieza"
      />

      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-gradient-to-br from-[hsl(160,100%,30%)] via-[hsl(160,100%,25%)] to-[hsl(160,100%,20%)] overflow-hidden" data-testid="section-empieza-hero">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[hsl(160,100%,50%)] rounded-full blur-[180px] -translate-y-1/2 translate-x-1/4" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-3xl">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Zap className="w-4 h-4 text-white" />
              <span className="text-sm text-white/90 font-medium">Plan Empieza</span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" data-testid="text-empieza-title">
              Tu Primera Presencia{" "}
              <span className="text-teal-200">Profesional en Internet</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-white/80 leading-relaxed mb-8 max-w-2xl">
              El primer paso para que tus clientes te encuentren. Un sitio web profesional que genera confianza y te pone en el mapa.
            </motion.p>
            <motion.p variants={fadeUp} className="text-4xl font-extrabold text-white mb-8">
              desde $497<span className="text-lg font-medium text-white/70">/mes</span>
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start gap-4">
              <Link href="/contacto">
                <Button size="lg" className="bg-white text-[hsl(160,100%,25%)] font-bold text-lg gap-2" data-testid="button-empieza-cta">
                  Empezar Ahora
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="tel:+1234567890">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10" data-testid="button-empieza-call">
                  <Phone className="w-5 h-5" />
                  (555) 123-4567
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-white dark:bg-gray-950" data-testid="section-empieza-features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
            <motion.p variants={fadeUp} className="text-[hsl(160,100%,37%)] font-bold text-sm uppercase tracking-widest mb-4">Qué Incluye</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
              Todo Lo Que Necesitas Para <span className="text-[hsl(160,100%,37%)]">Empezar</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {included.map((item) => (
              <motion.div key={item.title} variants={fadeUp} className="p-8 rounded-md bg-gray-50 dark:bg-gray-900">
                <div className="w-14 h-14 rounded-md bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center mb-6">
                  <item.icon className="w-7 h-7 text-[hsl(160,100%,37%)]" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-gray-50 dark:bg-gray-900" data-testid="section-empieza-ideal">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.p variants={fadeUp} className="text-[hsl(160,100%,37%)] font-bold text-sm uppercase tracking-widest mb-4 text-center">Ideal Para</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight mb-8 text-center">
              ¿Es Este Plan Para Ti?
            </motion.h2>
            <motion.div variants={fadeUp} className="bg-white dark:bg-gray-800 rounded-md p-8 lg:p-10">
              <ul className="space-y-4">
                {[
                  "Estás empezando tu negocio de contratista",
                  "No tienes sitio web o el que tienes no se ve profesional",
                  "Quieres que tus clientes te encuentren en Google",
                  "Necesitas un formulario para recibir cotizaciones",
                  "Tu presupuesto de marketing es limitado pero quieres empezar",
                  "Quieres verte tan profesional como las empresas grandes",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[hsl(160,100%,37%)] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-gradient-to-r from-[hsl(160,100%,37%)] to-[hsl(160,100%,28%)]" data-testid="section-empieza-cta-bottom">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
              Da El Primer Paso Hoy
            </motion.h2>
            <motion.p variants={fadeUp} className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
              Tu competencia ya tiene presencia en internet. Es hora de que tú también la tengas.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/contacto">
                <Button size="lg" className="bg-white text-[hsl(160,100%,25%)] font-bold text-lg gap-2" data-testid="button-empieza-cta-bottom">
                  Empieza Ahora
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/paquetes">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10" data-testid="button-empieza-ver-paquetes">
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
