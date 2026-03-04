// TODO: Add <meta name="robots" content="noindex,nofollow"> once site goes public
import { Link } from "wouter";
import { CheckCircle, ArrowRight } from "lucide-react";
import { demoConfig, tierColors, DemoTier } from "@/demo-config";

const tiers: DemoTier[] = ["empieza", "crece", "domina"];

export default function DemoHub() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col" data-testid="page-demo-hub">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-bold tracking-widest uppercase text-gray-500 border border-white/10 rounded-full px-4 py-1 mb-5">
            Demo Hub
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Selecciona un plan para ver el demo
          </h1>
          <p className="text-gray-400 text-base max-w-md mx-auto">
            Estos demos son para uso exclusivo durante llamadas de ventas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
          {tiers.map((tier) => {
            const cfg = demoConfig[tier];
            const colors = tierColors[cfg.color];
            return (
              <div
                key={tier}
                data-testid={`card-demo-${tier}`}
                className={`relative rounded-2xl border ${colors.border} ${colors.bg} p-7 flex flex-col gap-5 transition-all duration-200 hover:scale-[1.02]`}
              >
                <div className="flex flex-col gap-1">
                  <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded self-start ${colors.badge}`}>
                    {cfg.tagline}
                  </span>
                  <h2 className={`text-2xl font-extrabold mt-2 ${colors.text}`}>
                    Plan {cfg.name}
                  </h2>
                  <p className="text-gray-400 text-sm leading-relaxed mt-1">
                    {cfg.description}
                  </p>
                </div>

                <ul className="flex flex-col gap-2 flex-1">
                  {cfg.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircle className={`w-4 h-4 mt-0.5 shrink-0 ${colors.text}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link href={`/demo/${tier}`}>
                  <button
                    data-testid={`button-view-demo-${tier}`}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all duration-150 ${colors.button}`}
                  >
                    Ver Demo
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
