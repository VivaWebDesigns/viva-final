import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import SEO from "@/components/SEO";
import ScrollToTop from "@/components/ScrollToTop";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import BookDemoButton from "@/components/WhatsAppButton";
import Home from "@/pages/Home";
import Paquetes from "@/pages/Paquetes";
import PaqueteEmpieza from "@/pages/PaqueteEmpieza";
import PaqueteCrece from "@/pages/PaqueteCrece";
import PaqueteDomina from "@/pages/PaqueteDomina";
import Contacto from "@/pages/Contacto";
import Demo from "@/pages/Demo";
import NotFound from "@/pages/not-found";
import JsonLd from "@/components/JsonLd";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/paquetes" component={Paquetes} />
      <Route path="/paquetes/empieza" component={PaqueteEmpieza} />
      <Route path="/paquetes/crece" component={PaqueteCrece} />
      <Route path="/paquetes/domina" component={PaqueteDomina} />
      <Route path="/contacto" component={Contacto} />
      <Route path="/demo" component={Demo} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ScrollToTop />
          <JsonLd />
          <div className="min-h-screen flex flex-col">
            <Navigation />
            <main className="flex-1">
              <Router />
            </main>
            <Footer />
          </div>
          <BookDemoButton />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
