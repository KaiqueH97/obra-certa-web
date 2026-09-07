export const UNCONFIRMED_MESSAGE =
  "Não foi possível confirmar a operação. Atualize a página antes de tentar novamente.";

export class MutationError extends Error {}

type RecordWithId = { id: number | string };
type MutationResponse<T> = {
  data: T | null;
  error: { code?: string; message: string } | null;
};

export type MutationOptions<T extends RecordWithId> = {
  key: string;
  loading: string;
  success: string;
  request: () => PromiseLike<MutationResponse<T>>;
  onConfirmed: (record: T) => void;
};

type Notifications = {
  loading: (message: string) => string;
  success: (message: string, id: string) => void;
  error: (message: string, id: string) => void;
};

// Um executor por tela: a trava síncrona também bloqueia cliques antes do rerender.
export function createMutationRunner(
  notifications: Notifications,
  onPendingChange: (keys: ReadonlySet<string>) => void,
) {
  const pending = new Set<string>();
  let active = true;

  return {
    activate() { active = true; },
    deactivate() { active = false; },
    async run<T extends RecordWithId>(options: MutationOptions<T>): Promise<T | null> {
      if (!active || pending.has(options.key)) return null;
      pending.add(options.key);
      onPendingChange(new Set(pending));
      const toastId = notifications.loading(options.loading);

      try {
        const { data, error } = await options.request();
        if (error?.code === "42501") {
          throw new MutationError("Você não tem permissão para realizar essa operação.");
        }
        if (error?.code === "PGRST116") {
          throw new MutationError("Registro não encontrado ou sem acesso. Atualize a página.");
        }
        if (error || !data || Array.isArray(data) ||
          !((typeof data.id === "number" && Number.isFinite(data.id)) ||
            (typeof data.id === "string" && data.id.length > 0))) {
          throw new MutationError(UNCONFIRMED_MESSAGE);
        }

        // A tela recebe exclusivamente a linha retornada pela própria gravação.
        if (active) options.onConfirmed(data);
        notifications.success(options.success, toastId);
        return data;
      } catch (error) {
        notifications.error(error instanceof MutationError ? error.message : UNCONFIRMED_MESSAGE, toastId);
        return null;
      } finally {
        pending.delete(options.key);
        if (active) onPendingChange(new Set(pending));
      }
    },
  };
}
