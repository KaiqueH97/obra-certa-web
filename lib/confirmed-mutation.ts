export const UNCONFIRMED_MESSAGE =
  "Não foi possível confirmar a operação. Ela pode ter sido concluída no servidor. Recarregue os dados e confira o resultado antes de tentar novamente.";

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
  onUnconfirmed: () => void = () => {},
  timeoutMs = 20000,
) {
  const pending = new Map<string, { controller: AbortController; cancel: () => void }>();
  const ownedToasts = new Set<string>();
  let active = true;
  let generation = 0;
  let requiresReload = false;
  const cancelled = Symbol("cancelled");
  const timedOut = Symbol("timeout");
  const publishPending = () => onPendingChange(new Set(pending.keys()));

  return {
    activate() {
      if (!active) {
        active = true;
        publishPending();
        if (requiresReload) onUnconfirmed();
      }
    },
    deactivate() {
      active = false;
      generation++;
      // Uma instância retomada não deve repetir uma gravação abandonada.
      if (pending.size > 0) requiresReload = true;
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
      if (!active || requiresReload || pending.has(options.key)) return null;
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
      let timer: ReturnType<typeof setTimeout> | undefined;
      let confirmed = false;

      try {
        const deadline = new Promise<typeof timedOut>(resolve => { timer = setTimeout(() => resolve(timedOut), timeoutMs); });
        const response = await Promise.race([options.request(controller.signal), cancellation, deadline]);
        if (!isCurrent() || response === cancelled) return null;
        if (response === timedOut) throw new Error(UNCONFIRMED_MESSAGE);
        const { data, error } = response;
        if (error?.code === "42501") {
          throw new MutationError("Você não tem permissão para realizar essa operação.");
        }
        if (error?.code === "PGRST116") {
          throw new Error(UNCONFIRMED_MESSAGE);
        }
        if (error !== null || !data || Array.isArray(data) ||
          !((typeof data.id === "number" && Number.isFinite(data.id)) ||
            (typeof data.id === "string" && data.id.length > 0))) {
          throw new Error(UNCONFIRMED_MESSAGE);
        }

        // A tela recebe exclusivamente a linha retornada pela própria gravação.
        confirmed = true;
        options.onConfirmed(data);
        if (isCurrent()) notifications.success(options.success, toastId);
        return data;
      } catch (error) {
        if (isCurrent()) {
          const rejected = error instanceof MutationError && !confirmed;
          if (!rejected && !requiresReload) {
            requiresReload = true;
            onUnconfirmed();
          }
          notifications.error(rejected ? error.message : UNCONFIRMED_MESSAGE, toastId);
        }
        return null;
      } finally {
        clearTimeout(timer);
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
