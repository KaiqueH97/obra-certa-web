import { LoadError } from "./load-data";
import { loadPage, type PaginatedRows } from "./pagination";

export { PAGE_SIZE as PROJECT_PAGE_SIZE, lastPage as lastProjectPage } from "./pagination";
export type Projeto = { id: number; titulo: string; user_id: string; criado_em: string };
export type ProjectPage = PaginatedRows<Projeto>;
// Compartilhado entre leitura e confirmação de gravação; não substitui RLS.
export function isProjeto(value: unknown): value is Projeto {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const row = value as Partial<Projeto>;
  return typeof row.id === "number" && Number.isSafeInteger(row.id) && row.id > 0 &&
    typeof row.titulo === "string" &&
    typeof row.user_id === "string" && row.user_id.trim().length > 0 &&
    typeof row.criado_em === "string" && Number.isFinite(Date.parse(row.criado_em));
}

// O tipo do SDK não valida a resposta recebida em tempo de execução.
export async function loadProjectPage(
  ...args: Parameters<typeof loadPage<Projeto>>
): Promise<ProjectPage> {
  const result = await loadPage<Projeto>(...args);
  if (result.rows.some(row => !isProjeto(row))) {
    throw new LoadError("A lista veio incompleta ou inconsistente. Tente novamente.");
  }
  return result;
}
