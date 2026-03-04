import { Link, useLocation } from "wouter";
import { ExternalLink, LayoutGrid } from "lucide-react";
import { demoConfig, tierColors, DemoTier } from "@/demo-config";

interface DemoBarProps {
  activeTier: DemoTier;
}

const tiers: DemoTier[] = ["empieza", "crece", "domina"];

export default function DemoBar({ activeTier }: DemoBarProps) {
  const [, navigate] = useLocation();
  const activeConfig = demoConfig[activeTier];
  const colors = tierColors[activeConfig.color];

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#0d0d0d] border-b border-white/10 flex items-center px-4 gap-4">
      <Link
        href="/demo"
        className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-medium transition-colors duration-150 shrink-0"
        data-testid="link-demo-hub"
      >
        <LayoutGrid className="w-4 h-4" />
        <span className="hidden sm:inline">Demo Hub</span>
      </Link>

      <div className="w-px h-6 bg-white/10 shrink-0" />

      <div className="flex items-center gap-1 flex-1 justify-center">
        {tiers.map((tier) => {
          const cfg = demoConfig[tier];
          const tc = tierColors[cfg.color];
          const isActive = tier === activeTier;
          return (
            <Link
              key={tier}
              href={`/demo/${tier}`}
              data-testid={`tab-demo-${tier}`}
              className={[
                "px-3 py-1.5 rounded text-sm font-semibold transition-all duration-150",
                isActive
                  ? `${tc.text} ${tc.activeBg} ring-1 ring-inset ${tc.border}`
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5",
              ].join(" ")}
            >
              {cfg.name}
            </Link>
          );
        })}
      </div>

      <div className="w-px h-6 bg-white/10 shrink-0" />

      {activeConfig.url ? (
        <a
          href={activeConfig.url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="button-open-live-demo"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-all duration-150 shrink-0 ${colors.button}`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Abrir Demo</span>
          <span className="sm:hidden">Demo</span>
        </a>
      ) : (
        <div className="w-[90px] hidden sm:block" />
      )}
    </div>
  );
}
