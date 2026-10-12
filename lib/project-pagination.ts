import { LoadError, LOAD_FAILURE } from "./load-data";

export const PROJECT_PAGE_SIZE = 20;
export type Projeto = { id: number; titulo: string; user_id: string; criado_em: string };
export type ProjectPage = { rows: Projeto[]; total: number; page: number };

export const lastProjectPage = (total: number) => Math.max(0, Math.ceil(total / PROJECT_PAGE_SIZE) - 1);

// Lê somente a faixa solicitada. A consulta deve ordenar por criado_em DESC, id DESC.
export async function loadProjectPage(
  query: (from: number, to: number) => PromiseLike<{ data: Projeto[] | null; count: number | null; error: unknown }>,
  page: number,
  signal: AbortSignal,
): Promise<ProjectPage> {
  if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger((page + 1) * PROJECT_PAGE_SIZE)) {
    throw new LoadError(LOAD_FAILURE);
  }
  signal.throwIfAborted();
  const from = page * PROJECT_PAGE_SIZE;
  const { data, count, error } = await query(from, from + PROJECT_PAGE_SIZE - 1);
  signal.throwIfAborted();
  // PostgREST pode responder 416/PGRST103, sem count, se a página sumiu.
  // Confirma o total numa faixa válida antes de pedir à tela que ajuste a página.
  if (page > 0 && typeof error === "object" && error !== null && "code" in error && error.code === "PGRST103") {
    const probe = await query(0, 0);
    signal.throwIfAborted();
    if (probe.error === null && Array.isArray(probe.data) && probe.count !== null &&
      Number.isSafeInteger(probe.count) && probe.count >= 0 && probe.count <= from &&
      probe.data.length === Math.min(1, probe.count)) {
      return { rows: [], total: probe.count, page };
    }
    throw new LoadError(LOAD_FAILURE);
  }
  if (error !== null || !Array.isArray(data) || count === null || !Number.isSafeInteger(count) || count < 0) {
    throw new LoadError(LOAD_FAILURE);
  }
  const expected = Math.min(PROJECT_PAGE_SIZE, Math.max(0, count - from));
  if (data.length !== expected || data.some(row => !Number.isSafeInteger(row?.id) || row.id <= 0) ||
    new Set(data.map(row => row.id)).size !== data.length) {
    throw new LoadError("A lista de obras veio incompleta ou inconsistente. Tente novamente.");
  }
  // Uma página vazia além do total permite voltar à última página após exclusões.
  return { rows: data, total: count, page };
}
