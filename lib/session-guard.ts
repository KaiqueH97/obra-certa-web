import { createDataLoader, LoadError } from "./load-data";

export type SessionView = {
  status: "checking" | "ready" | "error" | "blocked";
  userId: string | null;
  error: string | null;
  destination?: "/login" | "/home";
};

type Dependencies = {
  getUser: () => PromiseLike<{ data: { user: { id: string } | null }; error: { status?: number } | null }>;
  isLoggingOut: () => boolean;
  hide: () => void;
  onState: (state: SessionView) => void;
  navigate: (path: string) => void;
};

export function createSessionGuard(deps: Dependencies, timeoutMs = 20000) {
  let ownerId: string | null = null;
  let observedId: string | null = null;
  let disposed = false;
  let blocked = false;
  let checking = false;
  let suspended = false;
  let scheduled: ReturnType<typeof setTimeout> | undefined;
  const loader = createDataLoader(state => {
    if (disposed || blocked) return;
    checking = state.status === "loading";
    if (state.status === "loading") {
      deps.hide();
      deps.onState({ status: "checking", userId: ownerId, error: null });
    } else if (state.status === "error") {
      deps.onState({ status: "error", userId: ownerId, error: "Não foi possível verificar sua sessão. Confira a conexão e tente novamente." });
    }
  }, timeoutMs);

  function block(destination: "/login" | "/home", localLogout = false) {
    if (disposed || blocked) return;
    blocked = true;
    checking = false;
    clearTimeout(scheduled);
    loader.cancel();
    deps.hide();
    deps.onState({ status: "blocked", userId: null, error: null, destination });
    // O executor de logout da própria aba decide entre saída normal e parcial.
    if (!localLogout) scheduled = setTimeout(() => {
      if (!disposed) deps.navigate(destination);
    }, 0);
  }

  async function check() {
    if (disposed || blocked || suspended || checking) return;
    loader.activate();
    await loader.run(async () => {
      const { data, error } = await deps.getUser();
      if (error) {
        if ([400, 401, 403].includes(error.status ?? 0)) return null;
        throw new LoadError("Sessão indisponível.");
      }
      return data.user?.id ?? null;
    }, id => {
      if (!id) { block("/login", deps.isLoggingOut()); return; }
      if ((ownerId && ownerId !== id) || (observedId && observedId !== id)) { block("/home"); return; }
      ownerId = id;
      deps.onState({ status: "ready", userId: id, error: null });
    });
  }

  function scheduleCheck() {
    if (disposed || blocked || suspended || checking || scheduled !== undefined) return;
    scheduled = setTimeout(() => { scheduled = undefined; void check(); }, 0);
  }

  return {
    check,
    scheduleCheck,
    resume() { suspended = false; scheduleCheck(); },
    // Callback síncrono: nenhuma chamada Auth dentro do evento do SDK.
    onAuthEvent(event: string, userId: string | null) {
      if (disposed || blocked) return;
      if (event === "SIGNED_OUT") { block("/login", deps.isLoggingOut()); return; }
      if (!userId) return;
      if (ownerId && ownerId !== userId) { block("/home"); return; }
      observedId = userId;
      if (!ownerId) scheduleCheck();
    },
    suspend() {
      if (disposed || blocked) return;
      clearTimeout(scheduled);
      scheduled = undefined;
      loader.cancel();
      checking = false;
      suspended = true;
      deps.hide();
      deps.onState({ status: "checking", userId: ownerId, error: null });
    },
    dispose() {
      disposed = true;
      clearTimeout(scheduled);
      loader.cancel();
    },
  };
}
