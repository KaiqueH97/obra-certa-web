import { LoadError } from "./load-data";
import { loadPage, type PaginatedRows } from "./pagination";

export { PAGE_SIZE as PROJECT_PAGE_SIZE, lastPage as lastProjectPage } from "./pagination";
export type Projeto = { id: number; titulo: string; user_id: string; criado_em: string };
export type ProjectPage = PaginatedRows<Projeto>;
// O tipo do SDK não valida a resposta recebida em tempo de execução.
export async function loadProjectPage(
  ...args: Parameters<typeof loadPage<Projeto>>
): Promise<ProjectPage> {
  const result = await loadPage<Projeto>(...args);
  if (result.rows.some(row =>
    typeof row.titulo !== "string" ||
    typeof row.user_id !== "string" || !row.user_id.trim() ||
    typeof row.criado_em !== "string" || !Number.isFinite(Date.parse(row.criado_em))
  )) {
    throw new LoadError("A lista veio incompleta ou inconsistente. Tente novamente.");
  }
  return result;
}
