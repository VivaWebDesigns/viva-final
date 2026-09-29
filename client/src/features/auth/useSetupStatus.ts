import { useQuery } from "@tanstack/react-query";

export interface SetupStatus {
  needsSetup: boolean;
  dbError?: boolean;
}

export function useSetupStatus(enabled = true) {
  return useQuery<SetupStatus>({
    queryKey: ["/api/users/setup-status"],
    queryFn: async () => {
      const res = await fetch("/api/users/setup-status");
      if (!res.ok) throw new Error(`Setup status check failed (${res.status})`);
      return res.json();
    },
    enabled,
    retry: false,
    staleTime: 0,
  });
}
