import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Phone, Heart, Target, Users, Shield, Award, Handshake, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import logoImg from "@assets/20BD1DF0-9B30-47F2-8E16-D17C4A22B42A_1771857217327.PNG";
import SEO from "@/components/SEO";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const values = [
  {
    icon: Heart,
    title: "Comunidad Primero",
    desc: "Nuestra comunidad latina es la razón por la que existimos. Cada proyecto es una oportunidad de elevar a uno de los nuestros.",
    color: "bg-pink-50 dark:bg-pink-950/20",
    iconColor: "text-[hsl(340,82%,52%)]",
  },
  {
    icon: Target,
    title: "Resultados Reales",
    desc: "No vendemos humo. Cada estrategia está diseñada para generar llamadas, clientes y crecimiento medible.",
    color: "bg-teal-50 dark:bg-teal-950/20",
    iconColor: "text-[hsl(160,100%,37%)]",
  },
  {
    icon: Shield,
    title: "Honestidad Total",
    desc: "Te decimos la verdad sobre lo que funciona y lo que no. Sin sorpresas, sin cargos ocultos, sin contratos largos.",
    color: "bg-amber-50 dark:bg-amber-950/20",
    iconColor: "text-amber-500",
  },
  {
    icon: Handshake,
    title: "Socios, No Proveedores",
    desc: "No somos un gasto más. Somos tu socio de marketing. Tu éxito es nuestro éxito.",
    color: "bg-blue-50 dark:bg-blue-950/20",
    iconColor: "text-blue-500",
  },
];

const milestones = [
  { year: "2019", title: "El Inicio", desc: "Viva Web Designs nace con la misión de ayudar a contratistas latinos a competir en el mundo digital." },
  { year: "2020", title: "Primeros 50 Clientes", desc: "A pesar de la pandemia, ayudamos a 50 contratistas a mantener y crecer sus negocios con presencia digital." },
  { year: "2022", title: "Expansión Nacional", desc: "Empezamos a servir contratistas en más de 20 estados, manteniendo nuestro enfoque en la comunidad latina." },
  { year: "2024", title: "500+ Proyectos", desc: "Alcanzamos más de 500 proyectos completados con un 95% de satisfacción entre nuestros clientes." },
  { year: "2025", title: "Innovación Continua", desc: "Seguimos innovando con nuevas herramientas de automatización y marketing digital para nuestros clientes." },
];

export default function Nosotros() {
  return (
    <div>
      <SEO
        title="Sobre Nosotros"
        description="Somos la agencia de marketing digital que entiende a los contratistas latinos. Hablamos tu idioma, conocemos tu cultura y luchamos por tu éxito."
        path="/nosotros"
      />
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 overflow-hidden" data-testid="section-nosotros-hero">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[hsl(160,100%,37%)] rounded-full blur-[180px] translate-y-1/2 translate-x-1/4" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.p variants={fadeUp} className="text-[hsl(340,82%,60%)] font-bold text-sm uppercase tracking-widest mb-4">
              Sobre Nosotros
            </motion.p>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6" data-testid="text-nosotros-title">
              La Agencia Que{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(340,82%,60%)] to-[hsl(160,100%,45%)]">
                Entiende Tu Negocio
              </span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
              Somos más que una agencia de marketing. Somos parte de tu comunidad, hablamos tu idioma y luchamos por tu éxito.
            </motion.p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-white dark:bg-gray-950" data-testid="section-story">
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
                Nuestra Historia
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight mb-6">
                Nacimos Para Servir a{" "}
                <span className="text-[hsl(160,100%,37%)]">Nuestra Comunidad</span>
              </h2>
              <div className="space-y-4 text-gray-600 dark:text-gray-400 leading-relaxed">
                <p>
                  Viva Web Designs nació de una frustración: ver a contratistas latinos con un trabajo increíble pero sin la presencia digital para competir con empresas más grandes.
                </p>
                <p>
                  Muchas agencias de marketing no entienden las necesidades de nuestra comunidad. No hablan nuestro idioma, no conocen nuestra cultura y cobran precios que no son accesibles para negocios pequeños.
                </p>
                <p>
                  Por eso creamos Viva Web Designs. Una agencia que habla español, que entiende los retos de un contratista independiente y que ofrece soluciones de marketing que realmente funcionan.
                </p>
                <p className="text-gray-900 dark:text-white font-semibold">
                  Nuestra misión es simple: que cada contratista latino tenga las herramientas digitales para crecer y prosperar.
                </p>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="relative">
              <div className="bg-gradient-to-br from-[hsl(340,82%,52%)] to-[hsl(160,100%,37%)] rounded-md p-1">
                <div className="bg-white dark:bg-gray-900 rounded-md p-10 text-center">
                  <img src={logoImg} alt="Viva Web Designs" className="h-20 mx-auto mb-6" />
                  <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-4">Nuestra Misión</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed italic">
                    "Empoderar a contratistas latinos con marketing digital profesional, accesible y efectivo para que compitan y ganen en su mercado."
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-gray-50 dark:bg-gray-900" data-testid="section-values">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <motion.p variants={fadeUp} className="text-[hsl(340,82%,52%)] font-bold text-sm uppercase tracking-widest mb-4">
              Nuestros Valores
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
              Lo Que Nos{" "}
              <span className="text-[hsl(340,82%,52%)]">Define</span>
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {values.map((value) => (
              <motion.div
                key={value.title}
                variants={fadeUp}
                className={`p-8 lg:p-10 rounded-md ${value.color}`}
              >
                <div className="w-14 h-14 rounded-md bg-white dark:bg-gray-800 flex items-center justify-center mb-6">
                  <value.icon className={`w-7 h-7 ${value.iconColor}`} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{value.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{value.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 lg:py-32 bg-white dark:bg-gray-950" data-testid="section-timeline">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} className="text-[hsl(340,82%,52%)] font-bold text-sm uppercase tracking-widest mb-4">
              Nuestra Trayectoria
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
              Años de{" "}
              <span className="text-[hsl(160,100%,37%)]">Crecimiento</span>
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="relative"
          >
            <div className="absolute left-8 lg:left-1/2 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700 lg:-translate-x-px" />

            {milestones.map((m, idx) => (
              <motion.div
                key={m.year}
                variants={fadeUp}
                className={`relative flex items-start gap-6 mb-12 last:mb-0 ${
                  idx % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
                }`}
              >
                <div className={`hidden lg:block lg:w-1/2 ${idx % 2 === 0 ? "lg:text-right lg:pr-12" : "lg:text-left lg:pl-12"}`}>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{m.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{m.desc}</p>
                </div>

                <div className="relative z-10 flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[hsl(340,82%,52%)] to-[hsl(160,100%,37%)] flex items-center justify-center text-white font-extrabold text-sm">
                    {m.year}
                  </div>
                </div>

                <div className={`lg:w-1/2 lg:hidden ${idx % 2 === 0 ? "" : ""}`}>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{m.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{m.desc}</p>
                </div>

                <div className={`hidden lg:block lg:w-1/2 ${idx % 2 === 0 ? "lg:pl-12" : "lg:pr-12"}`} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-gray-950" data-testid="section-nosotros-stats">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Award, value: "6+", label: "Años de Experiencia" },
              { icon: Users, value: "500+", label: "Clientes Atendidos" },
              { icon: Target, value: "95%", label: "Tasa de Retención" },
              { icon: TrendingUp, value: "3x", label: "ROI Promedio" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon className="w-8 h-8 text-[hsl(340,82%,52%)] mx-auto mb-3" />
                <p className="text-3xl sm:text-4xl font-extrabold text-white mb-1">{stat.value}</p>
                <p className="text-gray-400 text-sm font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-gradient-to-r from-[hsl(160,100%,30%)] to-[hsl(160,100%,25%)]" data-testid="section-nosotros-cta">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
            ¿Quieres Conocernos Mejor?
          </h2>
          <p className="text-xl text-white/90 mb-10">
            Agenda una llamada con nosotros. Queremos conocer tu negocio y mostrarte cómo podemos ayudarte a crecer.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/contacto">
              <Button size="lg" className="bg-white text-[hsl(160,100%,30%)] font-bold text-lg gap-2" data-testid="button-nosotros-cta">
                Agenda Tu Llamada
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="tel:+1234567890">
              <Button size="lg" variant="outline" className="text-white border-white/40 font-bold text-lg gap-2 bg-white/10" data-testid="button-nosotros-call">
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
