import { loadPage, type PaginatedRows } from "./pagination";

export { PAGE_SIZE as PROJECT_PAGE_SIZE, lastPage as lastProjectPage } from "./pagination";
export type Projeto = { id: number; titulo: string; user_id: string; criado_em: string };
export type ProjectPage = PaginatedRows<Projeto>;
export const loadProjectPage = loadPage<Projeto>;
