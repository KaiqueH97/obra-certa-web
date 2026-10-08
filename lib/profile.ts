import { LoadError } from "./load-data";

export type Profile = { id: string; nome: string; telefone: string; email: string };
export type ProfileInput = Pick<Profile, "nome" | "telefone">;
type AuthResponse = {
  data: { user: { id: string; email?: string; user_metadata?: unknown } | null } | null;
  error: { status?: number } | null;
};
export type ProfileSaveState = { status: "idle" | "saving" | "success" | "uncertain" | "blocked"; message: string | null };

function metadata(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function readProfile(response: AuthResponse): Profile {
  const user = response?.data?.user;
  if (response?.error !== null || typeof user?.id !== "string" || !user.id) {
    throw new LoadError("Não foi possível carregar seu perfil. Confira sua conexão e tente novamente.");
  }
  const data = metadata(user.user_metadata);
  return {
    id: user.id,
    nome: typeof data.nome === "string" && data.nome.trim() ? data.nome.trim() : "Usuário",
    telefone: typeof data.telefone === "string" ? data.telefone.trim() : "",
    email: typeof user.email === "string" && user.email ? user.email : "E-mail não informado",
  };
}

export function profileInitials(nome: string) {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || nome === "Usuário") return "OC";
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Dependencies = {
  getUser: () => PromiseLike<AuthResponse>;
  update: (input: ProfileInput) => PromiseLike<AuthResponse>;
  isAuthBusy: () => boolean;
  onState: (state: ProfileSaveState) => void;
  onConfirmed: (profile: Profile) => void;
};
const UNCERTAIN = "Não foi possível confirmar a atualização. O servidor pode ter salvo seus dados. Recarregue o perfil para conferir antes de editar novamente.";

export function createProfileSaver(deps: Dependencies, timeoutMs = 20000) {
  let active = true;
  let status: ProfileSaveState["status"] = "idle";
  let version = 0;
  let cancel: (() => void) | undefined;
  const cancelled = Symbol("cancelled"), timedOut = Symbol("timeout"), blocked = Symbol("blocked");
  const publish = (next: ProfileSaveState["status"], message: string | null = null) => {
    status = next;
    deps.onState({ status: next, message });
  };
  return {
    activate() {
      active = true;
      // Se React retomar a mesma instância, não restaura um envio sem confirmação.
      if (status === "saving") publish("uncertain", UNCERTAIN);
    },
    deactivate() { active = false; version++; cancel?.(); cancel = undefined; },
    reset() { if (active && (status === "idle" || status === "success")) publish("idle"); },
    async save(expectedId: string, input: ProfileInput) {
      if (!active || status !== "idle" || deps.isAuthBusy()) return;
      const values = { nome: input.nome.trim(), telefone: input.telefone.trim() };
      if (!values.nome) { publish("idle", "O nome não pode ficar vazio."); return; }
      const current = ++version;
      let finished = false, sent = false;
      const isCurrent = () => active && current === version && !finished;
      publish("saving");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          Promise.resolve().then(async () => {
            if (!isCurrent()) return cancelled;
            const verified = readProfile(await deps.getUser());
            if (!isCurrent()) return cancelled;
            if (verified.id !== expectedId || deps.isAuthBusy()) return blocked;
            sent = true;
            return deps.update(values);
          }),
          new Promise<typeof timedOut>(resolve => { timer = setTimeout(() => resolve(timedOut), timeoutMs); }),
          new Promise<typeof cancelled>(resolve => { cancel = () => resolve(cancelled); }),
        ]);
        if (!isCurrent() || result === cancelled) return;
        if (result === blocked) { publish("blocked", "Sua sessão mudou. Recarregue o perfil antes de continuar."); return; }
        if (result === timedOut) {
          publish(sent ? "uncertain" : "idle", sent ? UNCERTAIN : "A validação demorou demais. Confira sua conexão e tente novamente.");
          return;
        }
        if (result?.error) {
          const code = result.error.status;
          if (code === 401 || code === 403) { publish("blocked", "Não foi possível validar sua sessão. Recarregue o perfil antes de continuar."); return; }
          if (code && code >= 400 && code < 500) {
            publish("idle", code === 429 ? "Muitas tentativas. Aguarde antes de tentar novamente." : "Não foi possível salvar. Confira os dados e tente novamente.");
            return;
          }
          publish("uncertain", UNCERTAIN);
          return;
        }
        const confirmed = readProfile(result);
        const returned = metadata(result.data?.user?.user_metadata);
        if (confirmed.id !== expectedId || returned.nome !== values.nome || returned.telefone !== values.telefone) {
          publish("uncertain", UNCERTAIN);
          return;
        }
        deps.onConfirmed(confirmed);
        publish("success", "Dados atualizados com sucesso!");
      } catch {
        if (isCurrent()) publish(sent ? "uncertain" : "idle", sent ? UNCERTAIN : "Não foi possível validar sua sessão. Confira sua conexão e tente novamente.");
      } finally {
        finished = true;
        clearTimeout(timer);
        if (current === version) cancel = undefined;
      }
    },
  };
}
