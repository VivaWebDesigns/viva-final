import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider, QueryFunction } from "@tanstack/react-query";
import { Router } from "wouter";

const testQueryFn: QueryFunction = async ({ queryKey }) => {
  const res = await fetch(queryKey.join("/") as string);
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return await res.json();
};

function createTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries:   { retry: false, gcTime: 0, queryFn: testQueryFn },
      mutations: { retry: false },
    },
  });
}

interface Options extends Omit<RenderOptions, "wrapper"> {
  route?: string;
}

export function renderWithProviders(ui: React.ReactElement, options: Options = {}) {
  const { route = "/", ...renderOptions } = options;

  // Point wouter at the desired route so <Redirect> and <Link> resolve correctly
  window.history.pushState({}, "", route);

  const queryClient = createTestClient();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <Router>{children}</Router>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
