import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";

const Home = lazy(() => import("@/pages/Home"));
const Services = lazy(() => import("@/pages/Services"));
const About = lazy(() => import("@/pages/About"));
const Contact = lazy(() => import("@/pages/Contact"));
const Gallery = lazy(() => import("@/pages/Gallery"));
const InteriorPainting = lazy(() => import("@/pages/services/InteriorPainting"));
const ExteriorPainting = lazy(() => import("@/pages/services/ExteriorPainting"));
const KitchenCabinetPainting = lazy(() => import("@/pages/services/KitchenCabinetPainting"));
const DeckStaining = lazy(() => import("@/pages/services/DeckStaining"));
const FenceStaining = lazy(() => import("@/pages/services/FenceStaining"));
const CommercialPainting = lazy(() => import("@/pages/services/CommercialPainting"));
const Portfolio = lazy(() => import("@/pages/Portfolio"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const NotFound = lazy(() => import("@/pages/not-found"));

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/services" component={Services} />
        <Route path="/services/interior-painting" component={InteriorPainting} />
        <Route path="/services/exterior-painting" component={ExteriorPainting} />
        <Route path="/services/kitchen-cabinet-painting" component={KitchenCabinetPainting} />
        <Route path="/services/deck-staining" component={DeckStaining} />
        <Route path="/services/fence-staining" component={FenceStaining} />
        <Route path="/services/commercial-painting" component={CommercialPainting} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/gallery" component={Gallery} />
        <Route path="/portfolio" component={Portfolio} />
        <Route path="/portfolio/:slug" component={ProjectDetail} />
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
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
