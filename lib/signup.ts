export type SignupInput = { nome: string; email: string; password: string };
export type SignupState = {
  status: "idle" | "submitting" | "email" | "redirecting" | "uncertain";
  error: string | null;
};
type User = { id: string };
type SignupResponse = {
  data: { user: User | null; session: { access_token: string; user: User } | null } | null;
  error: { code?: string; status?: number } | null;
};
type Dependencies = {
  request: (input: SignupInput) => PromiseLike<SignupResponse>;
  onState: (state: SignupState) => void;
  clearPassword: () => void;
  navigate: (path: string) => void;
};

const UNCERTAIN = "Não foi possível confirmar o resultado do cadastro. Confira seu e-mail ou tente entrar antes de enviar outro cadastro.";

// Instância por página. Não repete automaticamente requisições de criação de conta.
export function createSignup(deps: Dependencies, timeoutMs = 20000) {
  let active = true;
  let status: SignupState["status"] = "idle";
  let version = 0;
  let cancelCurrent: (() => void) | undefined;
  const cancelled = Symbol("cancelled");
  const timeout = Symbol("timeout");
  const publish = (next: SignupState["status"], error: string | null = null) => {
    status = next;
    if (next === "uncertain") deps.clearPassword();
    deps.onState({ status: next, error });
  };

  return {
    activate() { active = true; },
    deactivate() {
      active = false;
      version++;
      cancelCurrent?.();
      if (status === "submitting") status = "idle";
    },
    async submit(input: SignupInput) {
      if (!active || status !== "idle") return;
      const credentials = { nome: input.nome.trim(), email: input.email.trim(), password: input.password };
      if (!credentials.nome || !credentials.email || credentials.password.length < 6) {
        publish("idle", "Preencha nome, e-mail e uma senha com pelo menos 6 caracteres.");
        return;
      }
      const current = ++version;
      const isCurrent = () => active && current === version;
      publish("submitting");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          Promise.resolve().then<SignupResponse | typeof cancelled>(() => isCurrent() ? deps.request(credentials) : cancelled),
          new Promise<typeof timeout>(resolve => { timer = setTimeout(() => resolve(timeout), timeoutMs); }),
          new Promise<typeof cancelled>(resolve => { cancelCurrent = () => resolve(cancelled); }),
        ]);
        if (!isCurrent() || result === cancelled) return;
        if (result === timeout) { publish("uncertain", UNCERTAIN); return; }
        const { data, error } = result;
        if (error) {
          if (!error.status || error.status >= 500) { publish("uncertain", UNCERTAIN); return; }
          const message = error.code === "weak_password" ? "Escolha uma senha mais forte para atender às regras de segurança." :
            error.status === 429 ? "Muitas tentativas. Aguarde antes de tentar novamente." :
            "Não foi possível concluir o cadastro. Confira os dados; se já tem conta, tente entrar ou recuperar o acesso.";
          publish("idle", message);
          return;
        }
        if (!data?.user?.id || data.session === undefined) { publish("uncertain", UNCERTAIN); return; }
        if (data.session === null) {
          deps.clearPassword();
          // O Auth pode devolver usuário ofuscado para uma conta já existente.
          publish("email");
          return;
        }
        if (!data.session.access_token || data.session.user?.id !== data.user.id) {
          publish("uncertain", UNCERTAIN);
          return;
        }
        deps.clearPassword();
        publish("redirecting");
        try {
          deps.navigate("/home");
        } catch {
          publish("uncertain", "A sessão foi criada, mas não foi possível abrir o sistema. Use o link para entrar.");
        }
      } catch {
        if (isCurrent()) publish("uncertain", UNCERTAIN);
      } finally {
        clearTimeout(timer);
        if (current === version) cancelCurrent = undefined;
      }
    },
  };
}
