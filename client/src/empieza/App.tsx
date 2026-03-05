import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@empieza/components/ui/toaster";
import { TooltipProvider } from "@empieza/components/ui/tooltip";
import Home from "@empieza/pages/Home";
import NotFound from "@empieza/pages/not-found";
import { LanguageProvider } from "@empieza/hooks/use-language";

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
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
