import { LoadError } from "./load-data";

export const MATERIALS_PAGE_SIZE = 20;
export type Material = { id: number; nome: string; quantidade: string; projeto_id: number; preco_total: number | null };
export type QuoteMaterial = Pick<Material, "id" | "nome" | "quantidade">;
export type MaterialsPage = { projeto_id: number; pagina: number; total: number; custo: number; materiais: Material[] };
const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const count = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const amount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER / 100;
const invalid = () => new LoadError("Não foi possível confirmar os materiais da obra. Tente novamente.");

function validateRows(rows: unknown[]): asserts rows is QuoteMaterial[] {
  let previous = Infinity;
  for (const row of rows) {
    if (!object(row) || !count(row.id) || row.id <= 0 || row.id >= previous ||
      typeof row.nome !== "string" || typeof row.quantidade !== "string") throw invalid();
    previous = row.id;
  }
}
export function parseMaterialsPage(value: unknown, projectId: string, requestedPage: number): MaterialsPage {
  if (!object(value) || !count(value.projeto_id) || value.projeto_id <= 0 || value.projeto_id !== Number(projectId) ||
    !count(value.pagina) || !count(value.total) || !amount(value.custo) || !Array.isArray(value.materiais) ||
    value.pagina !== Math.min(requestedPage, Math.max(0, Math.ceil(value.total / MATERIALS_PAGE_SIZE) - 1)) ||
    value.materiais.length !== Math.min(MATERIALS_PAGE_SIZE, Math.max(0, value.total - value.pagina * MATERIALS_PAGE_SIZE))) throw invalid();
  validateRows(value.materiais);
  for (const row of value.materiais as unknown as Record<string, unknown>[]) {
    if (row.projeto_id !== value.projeto_id || (row.preco_total !== null && !amount(row.preco_total))) throw invalid();
  }
  return value as MaterialsPage;
}
export function parseMaterialQuote(value: unknown, projectId: string): QuoteMaterial[] {
  if (!object(value) || !count(value.projeto_id) || value.projeto_id <= 0 || value.projeto_id !== Number(projectId) ||
    !count(value.total) || !Array.isArray(value.materiais) || value.materiais.length !== value.total) throw invalid();
  validateRows(value.materiais);
  return value.materiais;
}
