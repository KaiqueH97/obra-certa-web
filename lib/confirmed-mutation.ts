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
  request: (signal: AbortSignal) => PromiseLike<MutationResponse<T>>;
  onConfirmed: (record: T) => void;
  onSettled?: () => void;
};

type Notifications = {
  loading: (message: string) => string;
  success: (message: string, id: string) => void;
  error: (message: string, id: string) => void;
  dismiss: (id: string) => void;
};

// Um executor por tela: a trava síncrona também bloqueia cliques antes do rerender.
export function createMutationRunner(
  notifications: Notifications,
  onPendingChange: (keys: ReadonlySet<string>) => void,
) {
  const pending = new Map<string, { controller: AbortController; cancel: () => void }>();
  const ownedToasts = new Set<string>();
  let active = true;
  let generation = 0;
  const cancelled = Symbol("cancelled");
  const publishPending = () => onPendingChange(new Set(pending.keys()));

  return {
    activate() {
      if (!active) { active = true; publishPending(); }
    },
    deactivate() {
      active = false;
      generation++;
      for (const operation of pending.values()) {
        operation.controller.abort();
        operation.cancel();
      }
      pending.clear();
      // Inclui avisos de resultado ainda visíveis, sempre pelo ID desta instância.
      for (const id of ownedToasts) notifications.dismiss(id);
      ownedToasts.clear();
    },
    async run<T extends RecordWithId>(options: MutationOptions<T>): Promise<T | null> {
      if (!active || pending.has(options.key)) return null;
      const version = generation;
      const controller = new AbortController();
      let cancel = () => {};
      const cancellation = new Promise<typeof cancelled>(resolve => { cancel = () => resolve(cancelled); });
      const operation = { controller, cancel };
      pending.set(options.key, operation);
      const isCurrent = () => active && version === generation && pending.get(options.key) === operation;
      publishPending();
      const toastId = notifications.loading(options.loading);
      ownedToasts.add(toastId);

      try {
        const response = await Promise.race([options.request(controller.signal), cancellation]);
        if (!isCurrent() || response === cancelled) return null;
        const { data, error } = response;
        if (error?.code === "42501") {
          throw new MutationError("Você não tem permissão para realizar essa operação.");
        }
        if (error?.code === "PGRST116") {
          throw new MutationError("Registro não encontrado ou sem acesso. Atualize a página.");
        }
        if (error !== null || !data || Array.isArray(data) ||
          !((typeof data.id === "number" && Number.isFinite(data.id)) ||
            (typeof data.id === "string" && data.id.length > 0))) {
          throw new MutationError(UNCONFIRMED_MESSAGE);
        }

        // A tela recebe exclusivamente a linha retornada pela própria gravação.
        options.onConfirmed(data);
        if (isCurrent()) notifications.success(options.success, toastId);
        return data;
      } catch (error) {
        if (isCurrent()) notifications.error(error instanceof MutationError ? error.message : UNCONFIRMED_MESSAGE, toastId);
        return null;
      } finally {
        controller.abort();
        if (isCurrent()) {
          try { options.onSettled?.(); }
          finally {
            if (isCurrent()) { pending.delete(options.key); publishPending(); }
          }
        }
      }
    },
  };
}
