"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createSessionGuard, type SessionView } from "@/lib/session-guard";
import { useAuthActions } from "./AuthActionsProvider";
import { LoadFeedback } from "./LoadFeedback";

export function PrivateSessionBoundary({ children }: { children: React.ReactNode }) {
  const { getPending } = useAuthActions();
  const [view, setView] = useState<SessionView>({ status: "checking", userId: null, error: null });
  const content = useRef<HTMLDivElement>(null);
  const guardRef = useRef<ReturnType<typeof createSessionGuard> | null>(null);

  useLayoutEffect(() => {
    // Também restaura o DOM se React agrupar checking → ready no mesmo render.
    if (content.current) content.current.hidden = view.status !== "ready";
  }, [view]);

  useEffect(() => {
    const guard = createSessionGuard({
      getUser: () => supabase.auth.getUser(),
      isLoggingOut: () => getPending() === "logout",
      hide: () => { if (content.current) content.current.hidden = true; },
      onState: setView,
      navigate: path => window.location.replace(path),
    });
    guardRef.current = guard;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      guard.onAuthEvent(event, session?.user.id ?? null);
    });
    const onFocus = () => { if (document.visibilityState === "visible") guard.resume(); };
    const onVisibility = () => document.visibilityState === "visible" ? guard.resume() : guard.suspend();
    // Oculta o DOM imediatamente antes de o navegador preservar a página no histórico.
    const onPageHide = () => guard.suspend();
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) { guard.suspend(); guard.resume(); } };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    if (document.visibilityState === "visible") guard.scheduleCheck();
    else guard.suspend();

    return () => {
      guard.dispose();
      guardRef.current = null;
      subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [getPending]);

  return <>
    {view.status === "blocked" ? <div role="status" className="p-6 text-zinc-800">
      <p>Sua sessão mudou. Redirecionando...</p>
      <a className="mt-3 inline-block font-bold underline" href={view.destination}>Continuar</a>
    </div> : view.status !== "ready" && <LoadFeedback error={view.error} retry={() => { void guardRef.current?.check(); }} />}
    {/* Mantém formulários durante uma verificação da mesma conta; descarta na troca. */}
    {view.userId && <div ref={content} hidden={view.status !== "ready"} key={view.userId}>{children}</div>}
  </>;
}
