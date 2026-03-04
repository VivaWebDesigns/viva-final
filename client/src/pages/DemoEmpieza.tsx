// TODO: Add <meta name="robots" content="noindex,nofollow"> once site goes public
import DemoBar from "@/components/DemoBar";
import { ExternalLink, WifiOff } from "lucide-react";
import { demoConfig, tierColors } from "@/demo-config";

export default function DemoEmpieza() {
  const cfg = demoConfig.empieza;
  const colors = tierColors[cfg.color];

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col" data-testid="page-demo-empieza">
      <DemoBar activeTier="empieza" />

      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-14">
        <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-10 max-w-lg w-full text-center flex flex-col items-center gap-6`}>
          <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${colors.badge}`}>
            {cfg.tagline}
          </span>

          <h1 className={`text-4xl font-extrabold ${colors.text}`}>
            Plan {cfg.name}
          </h1>

          <p className="text-gray-400 text-base leading-relaxed max-w-sm">
            {cfg.description}
          </p>

          {cfg.url ? (
            <a
              href={cfg.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="button-open-demo-empieza"
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-base transition-all duration-150 ${colors.button}`}
            >
              <ExternalLink className="w-5 h-5" />
              Abrir Demo en Nueva Pestaña
            </a>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4" data-testid="msg-demo-not-connected-empieza">
              <WifiOff className="w-8 h-8 text-gray-600" />
              <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
                Demo no conectado aún. Agrega la URL en el archivo de configuración.
              </p>
              <code className="text-xs text-gray-600 bg-white/5 px-3 py-1.5 rounded font-mono">
                demo-config.ts → empieza.url
              </code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
