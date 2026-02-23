import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Zap, Globe, Search, FileText, MessageSquare, Shield, Phone, Smartphone, Rocket, Star } from "lucide-react";
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
    title: "Sitio Web Profesional (1–3 Páginas)",
    desc: "Ya no tendrás que dar solo tu número de teléfono. Tendrás un sitio web profesional donde tus clientes pueden ver tu trabajo, saber quién eres y contactarte al instante. Esto genera confianza antes de que te llamen.",
    why: "Un cliente que ve un sitio profesional confía más y te llama más rápido.",
  },
  {
    icon: Smartphone,
    title: "Diseño Móvil Optimizado",
    desc: "El 80% de tus clientes te buscan desde su teléfono. Tu sitio se verá perfecto en cualquier dispositivo — rápido, limpio y fácil de navegar.",
    why: "Si tu sitio no se ve bien en el teléfono, pierdes clientes antes de que te contacten.",
  },
  {
    icon: Phone,
    title: "WhatsApp + Click-to-Call",
    desc: "Botones visibles para que tus clientes te llamen o te escriban por WhatsApp con un solo toque. Sin barreras, sin formularios complicados.",
    why: "Entre más fácil sea contactarte, más llamadas recibes.",
  },
  {
    icon: Search,
    title: "Optimización SEO Básica",
    desc: "Configuramos tu sitio para que Google entienda qué haces y dónde trabajas. Títulos, descripciones y estructura optimizada para búsquedas locales.",
    why: "Sin SEO básico, Google no sabe que existes. Con él, empiezas a aparecer.",
  },
  {
    icon: FileText,
    title: "Google Business Profile",
    desc: "Creamos o optimizamos tu perfil de Google para que aparezcas en Google Maps cuando alguien busque servicios como los tuyos en tu área.",
    why: "Google Maps es donde la mayoría de clientes locales buscan contratistas.",
  },
  {
    icon: Shield,
    title: "Hosting + SSL + Soporte",
    desc: "Tu sitio web siempre en línea, rápido y seguro con certificado SSL incluido. Más soporte por email para cualquier duda o cambio que necesites.",
    why: "Un sitio caído o inseguro aleja clientes. El tuyo estará siempre listo.",
  },
];

export default function PaqueteEmpieza() {
  return (
    <div className="overflow-x-hidden">
      <SEO
        title="Plan Empieza - Tu Primera Presencia Profesional Online"
        description="El plan perfecto para contratistas que están empezando. Sitio web profesional, SEO básico, Google Business Profile y Click-to-Call desde $497/mes."
        path="/paquetes/empieza"
      />

      {/* HERO */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-[#111] overflow-hidden" data-testid="section-empieza-hero">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#0D9488] rounded-full blur-[180px] -translate-y-1/2 translate-x-1/4" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-3xl">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Zap className="w-4 h-4 text-white" />
              <span className="text-sm text-white/90 font-medium">Plan Empieza</span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" data-testid="text-empieza-title">
              Deja de perder clientes por no tener{" "}
              <span className="text-teal-200">presencia profesional.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-white/80 leading-relaxed mb-8 max-w-2xl">
              Tu primer sitio web profesional. Todo lo que necesitas para que tus clientes te encuentren, confíen en ti y te llamen.
            </motion.p>
            <motion.p variants={fadeUp} className="text-4xl font-extrabold text-white mb-2">
              desde $497
            </motion.p>
            <motion.p variants={fadeUp} className="text-xs text-white/60 font-medium mb-8">Más plan mensual requerido.</motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start gap-4">
              <Link href="/contacto">
                <Button size="lg" className="bg-[#0D9488] text-white font-bold text-lg gap-2 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-empieza-cta">
                  Quiero Empezar
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="https://wa.me/1234567890?text=Hola%2C%20me%20interesa%20el%20Plan%20Empieza" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-empieza-whatsapp">
                  <SiWhatsapp className="w-5 h-5" />
                  Hablar por WhatsApp
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-empieza-ideal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp}>
              <p className="text-[#0D9488] font-bold text-sm uppercase tracking-widest mb-4">¿Para Quién Es?</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111] dark:text-white leading-tight mb-6" data-testid="text-empieza-ideal-title">
                Este plan es para ti si...
              </h2>
              <ul className="space-y-4">
                {[
                  "Estás empezando tu negocio y necesitas verte profesional desde el día uno",
                  "No tienes sitio web, o el que tienes no te representa",
                  "Quieres que tus clientes te encuentren en Google en tu área",
                  "Necesitas un número de WhatsApp y teléfono visible para recibir llamadas",
                  "Tu presupuesto es limitado pero sabes que necesitas presencia online",
                  "Quieres dejar de depender solo de referencias y boca a boca",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#10B981] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp} className="bg-gradient-to-br from-[#0D9488] to-[#0F766E] rounded-md p-1">
              <div className="bg-white dark:bg-[#111] rounded-md p-8 lg:p-10 text-center">
                <Zap className="w-16 h-16 text-[#0D9488] mx-auto mb-6" />
                <h3 className="text-2xl font-extrabold text-[#111] dark:text-white mb-3">Plan Empieza</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Tu base profesional para competir</p>
                <p className="text-5xl font-extrabold text-[#0D9488] mb-1">$497</p>
                <p className="text-[10px] text-gray-400 font-medium mb-4">Más plan mensual requerido.</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* WHAT'S INCLUDED — BENEFIT DRIVEN */}
      <section className="py-24 lg:py-40 bg-[#f5f5f5] dark:bg-[#111]" data-testid="section-empieza-features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="text-center max-w-3xl mx-auto mb-16">
            <motion.p variants={fadeUp} className="text-[#0D9488] font-bold text-sm uppercase tracking-widest mb-4">Qué Incluye</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-empieza-features-title">
              Todo Lo Que Necesitas Para <span className="text-[#0D9488]">Empezar Bien</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="space-y-8">
            {included.map((item, i) => (
              <motion.div key={item.title} variants={fadeUp} className="bg-white dark:bg-gray-800 rounded-md p-8 lg:p-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-1">
                    <div className="w-14 h-14 rounded-md bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center">
                      <item.icon className="w-7 h-7 text-[#10B981]" />
                    </div>
                  </div>
                  <div className="lg:col-span-7">
                    <h3 className="text-xl font-bold text-[#111] dark:text-white mb-2">{item.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                  <div className="lg:col-span-4 bg-[#10B981]/5 rounded-md p-4">
                    <p className="text-sm font-semibold text-[#10B981]">
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
      <section className="py-24 lg:py-40 bg-white dark:bg-[#0d0d0d]" data-testid="section-empieza-upgrade">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div variants={fadeUp} className="text-center mb-12">
              <p className="text-[#0D9488] font-bold text-sm uppercase tracking-widest mb-4">¿Necesitas Más?</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111] dark:text-white leading-tight" data-testid="text-empieza-upgrade-title">
                Cuando estés listo para crecer, el <span className="text-[#0D9488]">Plan Crece</span> te espera
              </h2>
            </motion.div>

            <motion.div variants={fadeUp} className="border-2 border-[#0D9488] rounded-md p-1">
              <div className="bg-white dark:bg-[#111] rounded-md p-8 lg:p-10">
                <div className="flex items-center gap-3 mb-6">
                  <Rocket className="w-8 h-8 text-[#0D9488]" />
                  <div>
                    <h3 className="text-xl font-extrabold text-[#111] dark:text-white">Plan Crece</h3>
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-[#0D9488] fill-[#0D9488]" />
                      <span className="text-sm font-bold text-[#0D9488]">Más Popular</span>
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                  Todo lo del Plan Empieza más: hasta 5 páginas, galería de trabajo, portafolio, página de reseñas, SEO avanzado, optimización por servicio, estrategia de reseñas y soporte prioritario por WhatsApp.
                </p>
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <Link href="/paquetes/crece">
                    <Button size="lg" className="bg-[#0D9488] text-white font-bold text-lg gap-2 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-empieza-ver-crece">
                      Ver Plan Crece
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="/paquetes">
                    <Button size="lg" variant="outline" className="font-bold text-lg gap-2 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-empieza-comparar">
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
              <Shield className="w-4 h-4 text-[#10B981]" />
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
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0" />
                  {item}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* STRONG CTA */}
      <section className="py-24 lg:py-40 bg-[#111]" data-testid="section-empieza-cta-bottom">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
              Cada día sin presencia online es dinero que dejas en la mesa.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
              Tu competencia ya tiene página web. Tus clientes están buscando servicios en Google ahora mismo. ¿Van a encontrarte a ti?
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/contacto">
                <Button size="lg" className="bg-[#0D9488] text-white font-bold text-lg gap-2 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-empieza-cta-bottom">
                  Quiero Empezar Hoy
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="https://wa.me/1234567890?text=Hola%2C%20me%20interesa%20el%20Plan%20Empieza" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10 rounded-full transition-all duration-200 hover:shadow-lg" data-testid="button-empieza-whatsapp-bottom">
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
