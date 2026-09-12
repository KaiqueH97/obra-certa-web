export class LoadError extends Error {}
export type LoadState = { status: "loading" | "ready" | "error"; error: string | null };
export const LOAD_FAILURE = "Não foi possível carregar os dados. Confira sua conexão e tente novamente.";

export function requireData<T>(response: { data: T | null; error: unknown }, missing = LOAD_FAILURE): NonNullable<T> {
  if (response.error) throw new LoadError(LOAD_FAILURE);
  if (response.data == null) throw new LoadError(missing);
  return response.data;
}

// Lê todas as páginas para não tratar o limite de linhas do servidor como total.
// A consulta precisa de count: 'exact' e uma ordenação determinística por ID.
export async function loadAllRows<T extends { id: number | string }>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>,
  signal: AbortSignal,
): Promise<T[]> {
  const rows: T[] = [];
  const ids = new Set<T["id"]>();
  let expected: number | undefined;
  do {
    signal.throwIfAborted();
    const response = await page(rows.length, rows.length + 499);
    const batch = requireData(response);
    if (!Array.isArray(batch) || response.count == null || !Number.isSafeInteger(response.count) || response.count < 0) {
      throw new LoadError(LOAD_FAILURE);
    }
    expected ??= response.count;
    if (expected !== response.count || (batch.length === 0 && rows.length < expected)) {
      throw new LoadError("Os dados mudaram ou vieram incompletos. Tente novamente.");
    }
    for (const row of batch) {
      if (row.id == null || ids.has(row.id)) throw new LoadError("Os dados vieram inconsistentes. Tente novamente.");
      ids.add(row.id);
      rows.push(row);
    }
    if (rows.length > expected) throw new LoadError(LOAD_FAILURE);
  } while (rows.length < expected);
  signal.throwIfAborted();
  return rows;
}

export function createDataLoader(onState: (state: LoadState) => void, timeoutMs = 20000) {
  let generation = 0;
  let active = true;
  let current: AbortController | undefined;
  return {
    activate() { active = true; },
    cancel() { active = false; generation++; current?.abort(); },
    async run<T>(load: (signal: AbortSignal) => Promise<T>, onLoaded: (data: T) => void) {
      if (!active) return;
      const version = ++generation;
      current?.abort();
      const controller = new AbortController();
      current = controller;
      onState({ status: "loading", error: null });
      let timer: ReturnType<typeof setTimeout> | undefined;
      let onAbort = () => {};
      try {
        const data = await Promise.race([
          Promise.resolve().then(() => { controller.signal.throwIfAborted(); return load(controller.signal); }),
          new Promise<never>((_, reject) => {
            onAbort = () => reject(new LoadError(LOAD_FAILURE));
            controller.signal.addEventListener("abort", onAbort, { once: true });
            timer = setTimeout(() => {
              reject(new LoadError("O carregamento demorou demais. Tente novamente."));
              controller.abort();
            }, timeoutMs);
          }),
        ]);
        if (active && version === generation) {
          onLoaded(data);
          onState({ status: "ready", error: null });
        }
      } catch (error) {
        if (active && version === generation) {
          onState({ status: "error", error: error instanceof LoadError ? error.message : LOAD_FAILURE });
        }
      } finally {
        clearTimeout(timer);
        controller.signal.removeEventListener("abort", onAbort);
        controller.abort();
      }
    },
  };
}
