import { useSession, signIn, signOut } from "./authClient";

export function useAuth() {
  const session = useSession();

  return {
    user: session.data?.user ?? null,
    session: session.data?.session ?? null,
    isLoading: session.isPending,
    isAuthenticated: !!session.data?.user,
    role: (session.data?.user as any)?.role as string | undefined,
    signIn: async (email: string, password: string) => {
      return signIn.email({ email, password });
    },
    signOut: async () => {
      await signOut();
    },
  };
}
