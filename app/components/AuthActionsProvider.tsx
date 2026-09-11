"use client";

import { createContext, useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import { createAuthActions, type Credentials, type PendingAuthAction } from "@/lib/auth-actions";

const AuthActionsContext = createContext<{
  pending: PendingAuthAction;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
} | null>(null);

export function AuthActionsProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingAuthAction>(null);
  const [actions] = useState(() => createAuthActions({
    signIn: credentials => supabase.auth.signInWithPassword(credentials),
    // Preserva o escopo global já usado pelo app antes desta correção.
    signOut: () => supabase.auth.signOut({ scope: "global" }),
    getSession: () => supabase.auth.getSession(),
    navigate: path => window.location.replace(path),
    onPendingChange: setPending,
    notices: {
      loading: message => toast.loading(message),
      success: (message, id) => { toast.success(message, { id }); },
      error: (message, id) => { toast.error(message, { id }); },
      dismiss: id => { toast.dismiss(id); },
    },
  }));

  useEffect(() => {
    actions.activate();
    return () => actions.deactivate();
  }, [actions]);

  return <AuthActionsContext.Provider value={{ pending, login: actions.login, logout: actions.logout }}>
    {children}
  </AuthActionsContext.Provider>;
}

export function useAuthActions() {
  const context = useContext(AuthActionsContext);
  if (!context) throw new Error("useAuthActions requer AuthActionsProvider.");
  return context;
}
