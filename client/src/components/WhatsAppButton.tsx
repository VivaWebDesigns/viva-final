import { CalendarDays } from "lucide-react";

import { useLocation } from "wouter";
import { CALENDLY_URL } from "@/lib/externalLinks";

export default function BookDemoButton() {
  const [location] = useLocation();
  
  // Hide on /demo page
  if (location === "/demo") return null;

  return (
    <a
      href={CALENDLY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#0D9488] text-white rounded-full pl-4 pr-5 py-3 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
      aria-label="Agenda una demo"
      data-testid="button-book-demo-float"
    >
      <CalendarDays className="w-6 h-6" />
      <span className="text-sm font-bold hidden sm:inline">Agenda una demo</span>
    </a>
  );
}
