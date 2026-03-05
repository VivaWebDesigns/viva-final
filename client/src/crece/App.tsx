import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@crece/components/ui/toaster";
import { TooltipProvider } from "@crece/components/ui/tooltip";
import { LanguageProvider } from "@crece/hooks/use-language";

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
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
