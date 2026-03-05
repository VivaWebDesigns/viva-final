import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@empieza/components/ui/toaster";
import { TooltipProvider } from "@empieza/components/ui/tooltip";
import Home from "@empieza/pages/Home";
import NotFound from "@empieza/pages/not-found";
import { LanguageProvider } from "@empieza/hooks/use-language";
import { SiWhatsapp } from "react-icons/si";

function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/17045550123"
      target="_blank"
      rel="noopener noreferrer"
      data-testid="button-whatsapp-float"
      style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9000, width: "56px", height: "56px", borderRadius: "50%", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(37,211,102,0.45)", transition: "transform 0.2s" }}
      onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.12)")}
      onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
    >
      <SiWhatsapp style={{ width: "30px", height: "30px", color: "#fff" }} />
    </a>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Router />
          <Toaster />
          <WhatsAppButton />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
