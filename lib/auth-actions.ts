type AuthError = { code?: string; message: string };
type User = { id: string };
type Session = { access_token: string; user: User };
export type Credentials = { email: string; password: string };
export type PendingAuthAction = "login" | "logout" | null;

type Dependencies = {
  signIn: (credentials: Credentials) => PromiseLike<{
    data: { user: User | null; session: Session | null } | null;
    error: AuthError | null;
  }>;
  signOut: () => PromiseLike<{ error: AuthError | null }>;
  getSession: () => PromiseLike<{ data: { session: Session | null }; error: AuthError | null }>;
  navigate: (path: string) => void;
  onPendingChange: (pending: PendingAuthAction) => void;
  notices: {
    loading: (message: string) => string;
    success: (message: string, id: string) => void;
    error: (message: string, id: string) => void;
    dismiss: (id: string) => void;
  };
};

class AuthActionError extends Error {}

export function createAuthActions(deps: Dependencies) {
  let busy = false;
  let active = true;

  async function run(action: Exclude<PendingAuthAction, null>, credentials?: Credentials) {
    if (busy || !active) return;
    busy = true;
    deps.onPendingChange(action);
    const id = deps.notices.loading(action === "login" ? "Conectando..." : "Saindo do sistema...");
    let navigating = false;
    try {
      let destination: string;
      if (action === "login") {
        if (!credentials) throw new AuthActionError("Informe e-mail e senha.");
        const { data, error } = await deps.signIn(credentials);
        if (error?.code === "invalid_credentials") throw new AuthActionError("E-mail ou senha incorretos.");
        if (error?.code === "email_not_confirmed") throw new AuthActionError("Confirme seu e-mail antes de entrar.");
        if (error || !data?.user?.id || !data.session?.access_token || data.session.user.id !== data.user.id) {
          throw new AuthActionError("Não foi possível confirmar o login. Confira sua conexão e tente novamente.");
        }
        destination = "/home";
      } else {
        let logoutError = false;
        try {
          logoutError = Boolean((await deps.signOut()).error);
        } catch {
          logoutError = true;
        }
        // Consulta apenas o estado local após signOut, não autoriza acesso a dados.
        // O SDK pode limpar a sessão local mesmo quando a revogação remota falha.
        const { data, error } = await deps.getSession();
        if (error || !data || data.session !== null) {
          throw new AuthActionError("Não foi possível confirmar a saída. Confira sua conexão e tente novamente.");
        }
        destination = logoutError ? "/login?saida=parcial" : "/login";
      }

      if (!active) { deps.notices.dismiss(id); return; }
      // A navegação completa reinicia o estado React e o cache de rotas desta aba.
      deps.navigate(destination);
      navigating = true;
      if (destination.includes("saida=parcial")) {
        deps.notices.dismiss(id); // A página de login apresenta o aviso após navegar.
      } else {
        deps.notices.success(action === "login" ? "Login confirmado." : "Sessão encerrada.", id);
      }
    } catch (error) {
      if (active) {
        deps.notices.error(error instanceof AuthActionError ? error.message :
          "Não foi possível concluir a operação. Atualize a página e tente novamente.", id);
      } else {
        deps.notices.dismiss(id);
      }
    } finally {
      // Mantém a trava durante a navegação, evitando nova requisição antes do unload.
      if (!navigating) {
        busy = false;
        if (active) deps.onPendingChange(null);
      }
    }
  }

  return {
    activate() { active = true; },
    deactivate() { active = false; },
    login: (credentials: Credentials) => run("login", credentials),
    logout: () => run("logout"),
  };
}
