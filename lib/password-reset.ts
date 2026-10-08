type User = { id: string; email?: string };
type AuthError = { status?: number; code?: string };
type UserResponse = { data: { user: User | null } | null; error: AuthError | null };
export type PasswordResetState = {
  status: "checking" | "ready" | "saving" | "invalid" | "uncertain" | "success";
  email: string | null;
  error: string | null;
};
type Dependencies = {
  initialize: () => PromiseLike<{ error: AuthError | null }>;
  hasPendingCallback: () => boolean;
  getUser: () => PromiseLike<UserResponse>;
  updatePassword: (password: string) => PromiseLike<UserResponse>;
  onState: (state: PasswordResetState) => void;
  clearPasswords: () => void;
};

const INVALID = "Não foi possível validar seu acesso. O link pode estar inválido ou expirado. Solicite um novo link de recuperação.";
const UNCERTAIN = "Não foi possível confirmar a alteração da senha. O envio pode ter sido processado. Evite reenviar; se precisar, solicite um novo link de recuperação.";

export function createPasswordReset(deps: Dependencies, timeoutMs = 20000) {
  let active = false;
  let status: PasswordResetState["status"] = "checking";
  let user: User | null = null;
  let version = 0;
  let cancelCurrent: (() => void) | undefined;
  const cancelled = Symbol("cancelled");
  const failed = Symbol("failed");
  const publish = (next: PasswordResetState["status"], error: string | null = null) => {
    status = next;
    if (next === "invalid" || next === "uncertain" || next === "success") deps.clearPasswords();
    deps.onState({ status: next, email: next === "invalid" ? null : user?.email ?? null, error });
  };

  // Cancela apenas a espera local. O SDK pode concluir uma requisição já enviada.
  async function run<T>(work: (isCurrent: () => boolean) => Promise<T>) {
    const current = ++version;
    let finished = false;
    const isCurrent = () => active && current === version && !finished;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        Promise.resolve().then<T | typeof cancelled>(() => isCurrent() ? work(isCurrent) : cancelled),
        new Promise<typeof failed>(resolve => { timer = setTimeout(() => resolve(failed), timeoutMs); }),
        new Promise<typeof cancelled>(resolve => { cancelCurrent = () => resolve(cancelled); }),
      ]);
      return isCurrent() ? result : cancelled;
    } catch {
      return isCurrent() ? failed : cancelled;
    } finally {
      clearTimeout(timer);
      // Impede que uma validação tardia inicie a gravação após timeout.
      finished = true;
      if (current === version) {
        cancelCurrent = undefined;
      }
    }
  }

  return {
    async activate() {
      active = true;
      user = null;
      publish("checking");
      const operation = run(async isCurrent => {
        // Reutiliza a inicialização automática do SDK, sem trocar o código duas vezes.
        // Uma falha no callback pode preservar outra sessão: getUser sozinho não basta.
        const initialized = await deps.initialize();
        if (!isCurrent() || initialized?.error !== null || deps.hasPendingCallback()) return null;
        return deps.getUser();
      });
      const current = version;
      const result = await operation;
      if (result === cancelled || !active || current !== version) return;
      if (result === failed || !result?.data?.user?.id || !result.data.user.email || result.error !== null) {
        publish("invalid", INVALID);
        return;
      }
      user = result.data.user;
      publish("ready");
    },
    deactivate() {
      active = false;
      version++;
      cancelCurrent?.();
      cancelCurrent = undefined;
      user = null;
    },
    sessionChanged(userId: string | null) {
      if (!active || status === "invalid") return;
      if (userId === null || (user && user.id !== userId)) {
        const wasSaving = status === "saving";
        version++;
        cancelCurrent?.();
        cancelCurrent = undefined;
        user = null;
        publish("invalid", wasSaving
          ? "A sessão mudou durante o envio, que pode ter sido processado. Solicite um novo link antes de continuar."
          : "Sua sessão terminou ou a conta conectada mudou. Solicite um novo link antes de continuar.");
      }
    },
    async submit(password: string, confirmation: string) {
      if (!active || status !== "ready" || !user) return;
      if (password.length < 6) { publish("ready", "A senha deve ter pelo menos 6 caracteres."); return; }
      if (password !== confirmation) { publish("ready", "As senhas não coincidem."); return; }
      const expectedId = user.id;
      let sent = false;
      publish("saving");
      const operation = run(async isCurrent => {
        const verified = await deps.getUser();
        if (!isCurrent() || verified?.error !== null || verified.data?.user?.id !== expectedId) return null;
        sent = true;
        return deps.updatePassword(password);
      });
      const current = version;
      const result = await operation;
      if (result === cancelled || !active || current !== version) return;
      if (!sent) { publish("invalid", INVALID); return; }
      if (result === failed || !result) { publish("uncertain", UNCERTAIN); return; }
      const { data, error } = result;
      if (error) {
        if (error.status === 401 || error.status === 403) { publish("invalid", INVALID); return; }
        if (!error.status || error.status < 400 || error.status >= 500) { publish("uncertain", UNCERTAIN); return; }
        publish("ready", error.status === 429 ? "Muitas tentativas. Aguarde antes de tentar novamente." :
          error.code === "same_password" ? "Escolha uma senha diferente da atual." :
          "Não foi possível alterar a senha. Confira se ela atende às regras de segurança e tente novamente.");
        return;
      }
      if (error !== null || data?.user?.id !== expectedId) { publish("uncertain", UNCERTAIN); return; }
      publish("success");
    },
  };
}
