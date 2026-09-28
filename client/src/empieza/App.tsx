import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import MotionProvider from "@/components/MotionProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@empieza/components/ui/toaster";
import { TooltipProvider } from "@empieza/components/ui/tooltip";
import Home from "@empieza/pages/Home";
import NotFound from "@empieza/pages/not-found";
import { LanguageProvider } from "@empieza/hooks/use-language";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <MotionProvider>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <TooltipProvider>
            <AppRouter />
            <Toaster />
          </TooltipProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MotionProvider>
  );
}

export default App;
