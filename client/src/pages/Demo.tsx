import { motion } from "framer-motion";
import { ArrowRight, Zap, Rocket, Crown, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const demos = [
  {
    slug: "empieza",
    title: "Empieza",
    description: "Ideal para contratistas que quieren una presencia profesional simple.",
    href: "/empieza",
    icon: Zap,
    badge: "inicio" as const,
  },
  {
    slug: "crece",
    title: "Crece",
    description: "Diseñado para negocios que quieren generar más clientes.",
    href: "/crece",
    icon: Rocket,
    badge: "popular" as const,
  },
  {
    slug: "domina",
    title: "Domina",
    description: "Un sitio completo creado para destacar y dominar en búsquedas locales.",
    href: "/domina",
    icon: Crown,
    badge: "bestValue" as const,
  },
];

function DemoBadge({ badge }: { badge: "inicio" | "popular" | "bestValue" }) {
  if (badge === "inicio") {
    return (
      <div className="flex justify-center -mb-4 relative z-30">
        <span className="bg-[#FCD34D] text-[#111] text-xs font-bold px-5 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-lg" data-testid="badge-inicio">
          <Zap className="w-3 h-3 fill-[#111]" />
          Inicio
        </span>
      </div>
    );
  }
  if (badge === "popular") {
    return (
      <div className="flex justify-center -mb-4 relative z-30">
        <span className="bg-[#0D9488] text-white text-xs font-bold px-5 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-lg" data-testid="badge-popular">
          <Star className="w-3 h-3 fill-white" />
          Más popular
        </span>
      </div>
    );
  }
  if (badge === "bestValue") {
    return (
      <div className="flex justify-center -mb-4 relative z-30">
        <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-5 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-lg" data-testid="badge-best-value">
          <Crown className="w-3 h-3 fill-white" />
          El Mejor Valor
        </span>
      </div>
    );
  }
  return null;
}

export default function Demo() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0d0d0d]">
      {/* HERO */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-[#111] overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#0D9488] rounded-full blur-[180px] -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#0D9488] rounded-full blur-[140px] translate-y-1/2 -translate-x-1/4" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6"
              data-testid="text-demo-title"
            >
              Explora nuestros{" "}
              <span className="text-teal-300">sitios de demostración</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="text-lg sm:text-xl text-white/75 leading-relaxed mb-10 max-w-2xl mx-auto"
            >
              Cada demo muestra cómo puede verse el sitio web de tu negocio.
            </motion.p>
            <motion.div variants={fadeUp}>
              <a href="#demos">
                <Button
                  size="lg"
                  className="bg-[#0D9488] text-white font-bold text-lg gap-2 rounded-full hover:shadow-lg transition-all duration-200"
                  data-testid="button-demo-scroll"
                >
                  Ver los demos
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* DEMO CARDS */}
      <section id="demos" className="py-24 lg:py-32 bg-[#f5f5f5] dark:bg-[#111]" data-testid="section-demos">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {demos.map((demo) => (
              <motion.div
                key={demo.slug}
                variants={fadeUp}
                className="relative flex flex-col"
                data-testid={`card-demo-${demo.slug}`}
              >
                <DemoBadge badge={demo.badge} />
                <div
                  className={`rounded-2xl border bg-white dark:bg-[#0d0d0d] flex flex-col flex-1 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 ${
                    demo.badge === "popular"
                      ? "border-[#0D9488]/40 shadow-lg shadow-[#0D9488]/5"
                      : "border-gray-200 dark:border-gray-800"
                  }`}
                >
                  <div className="p-8 lg:p-10 flex flex-col flex-1">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 bg-[#10B981]/10">
                      <demo.icon className="w-6 h-6 text-[#10B981]" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-[#111] dark:text-white mb-3">
                      {demo.title}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed flex-1 mb-8">
                      {demo.description}
                    </p>
                    <a href={demo.href}>
                      <Button
                        size="lg"
                        className={`w-full rounded-full font-bold text-base gap-2 transition-all duration-200 hover:shadow-md ${
                          demo.badge === "popular"
                            ? "bg-[#0D9488] text-white hover:bg-[#0F766E]"
                            : "bg-[#111] dark:bg-white text-white dark:text-[#111]"
                        }`}
                        data-testid={`button-ver-demo-${demo.slug}`}
                      >
                        Ver Demo
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-center text-xs text-gray-400 dark:text-gray-500 mt-10"
            data-testid="text-demo-note"
          >
            Cada demo incluye un selector superior para cambiar entre los ejemplos o volver al sitio principal.
          </motion.p>
        </div>
      </section>
    </div>
  );
}
