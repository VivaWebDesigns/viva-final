import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@domina/components/ui/toaster";
import { TooltipProvider } from "@domina/components/ui/tooltip";
import { LanguageProvider } from "@domina/i18n/LanguageContext";

const Home = lazy(() => import("@domina/pages/Home"));
const Services = lazy(() => import("@domina/pages/Services"));
const About = lazy(() => import("@domina/pages/About"));
const Contact = lazy(() => import("@domina/pages/Contact"));
const Gallery = lazy(() => import("@domina/pages/Gallery"));
const InteriorPainting = lazy(() => import("@domina/pages/services/InteriorPainting"));
const ExteriorPainting = lazy(() => import("@domina/pages/services/ExteriorPainting"));
const KitchenCabinetPainting = lazy(() => import("@domina/pages/services/KitchenCabinetPainting"));
const DeckStaining = lazy(() => import("@domina/pages/services/DeckStaining"));
const FenceStaining = lazy(() => import("@domina/pages/services/FenceStaining"));
const CommercialPainting = lazy(() => import("@domina/pages/services/CommercialPainting"));
const ServiceDetail = lazy(() => import("@domina/pages/services/ServiceDetail"));
const Portfolio = lazy(() => import("@domina/pages/Portfolio"));
const ProjectDetail = lazy(() => import("@domina/pages/ProjectDetail"));
const NotFound = lazy(() => import("@domina/pages/not-found"));

function AppRouter() {
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
        <Route path="/services/:slug" component={ServiceDetail} />
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
          <AppRouter />
          <Toaster />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
