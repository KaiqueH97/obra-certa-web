export type RecoveryState = {
  status: "idle" | "sending" | "accepted" | "uncertain";
  error: string | null;
};
type Response = { data: unknown; error: { status?: number; code?: string } | null };
type Dependencies = {
  request: (email: string) => PromiseLike<Response>;
  onState: (state: RecoveryState) => void;
};

const UNCERTAIN = "Não foi possível confirmar a solicitação. Confira sua caixa de entrada e o spam antes de solicitar outro link.";

export function createPasswordRecovery(deps: Dependencies, timeoutMs = 20000) {
  let active = true;
  let status: RecoveryState["status"] = "idle";
  let generation = 0;
  let cancel: (() => void) | undefined;
  const cancelled = Symbol("cancelled");
  const timedOut = Symbol("timeout");
  const publish = (next: RecoveryState["status"], error: string | null = null) => {
    status = next;
    deps.onState({ status: next, error });
  };

  return {
    activate() { active = true; },
    deactivate() {
      active = false;
      generation++;
      cancel?.();
      if (status === "sending") status = "idle";
    },
    async submit(input: string) {
      if (!active || status !== "idle") return;
      const email = input.trim();
      if (!email) { publish("idle", "Informe seu e-mail."); return; }
      const version = ++generation;
      const isCurrent = () => active && version === generation;
      publish("sending");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const response = await Promise.race([
          Promise.resolve().then<Response | typeof cancelled>(() => isCurrent() ? deps.request(email) : cancelled),
          new Promise<typeof timedOut>(resolve => { timer = setTimeout(() => resolve(timedOut), timeoutMs); }),
          new Promise<typeof cancelled>(resolve => { cancel = () => resolve(cancelled); }),
        ]);
        if (!isCurrent() || response === cancelled) return;
        if (response === timedOut) { publish("uncertain", UNCERTAIN); return; }
        const { data, error } = response;
        if (error) {
          if (!error.status || error.status >= 500) { publish("uncertain", UNCERTAIN); return; }
          publish("idle", error.status === 429 ? "Muitas solicitações. Aguarde antes de tentar novamente." :
            "Não foi possível solicitar o link. Confira o e-mail e tente novamente.");
          return;
        }
        // O SDK instalado retorna data: {} e error: null quando o Auth aceita.
        if (error !== null || data === null || typeof data !== "object" || Array.isArray(data)) {
          publish("uncertain", UNCERTAIN);
          return;
        }
        publish("accepted");
      } catch {
        if (isCurrent()) publish("uncertain", UNCERTAIN);
      } finally {
        clearTimeout(timer);
        if (version === generation) cancel = undefined;
      }
    },
  };
}
