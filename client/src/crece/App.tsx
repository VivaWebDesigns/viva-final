import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@crece/components/ui/toaster";
import { TooltipProvider } from "@crece/components/ui/tooltip";
import { LanguageProvider } from "@crece/hooks/use-language";
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

const Home = lazy(() => import("@crece/pages/Home"));
const Services = lazy(() => import("@crece/pages/Services"));
const About = lazy(() => import("@crece/pages/About"));
const Contact = lazy(() => import("@crece/pages/Contact"));
const Gallery = lazy(() => import("@crece/pages/Gallery"));
const NotFound = lazy(() => import("@crece/pages/not-found"));

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/services" component={Services} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/gallery" component={Gallery} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
