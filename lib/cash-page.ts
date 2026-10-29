import { LoadError } from "./load-data";

export const CASH_PAGE_SIZE = 20;
export type CashTransaction = {
  id: number;
  tipo: "RECEBIMENTO_CLIENTE" | "PAGAMENTO_FUNCIONARIO";
  valor: number;
  data: string;
  descricao: string | null;
  funcionario_id: number | null;
  funcionarios: { nome: string } | null;
};
export type CashPage = {
  projeto_id: number; pagina: number; total: number;
  entradas: number; pagamentos: number; transacoes: CashTransaction[];
};
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const amount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER / 100;

// Nunca transforma RPC ausente, parcial ou de outra obra em caixa zerado.
export function parseCashPage(value: unknown, projectId: string, requestedPage: number): CashPage {
  const invalid = () => new LoadError("Não foi possível confirmar o caixa da obra. Tente novamente.");
  if (!object(value) || !count(value.projeto_id) || value.projeto_id <= 0 ||
    value.projeto_id !== Number(projectId) || !count(value.pagina) || !count(value.total) ||
    !amount(value.entradas) || !amount(value.pagamentos) || !Array.isArray(value.transacoes) ||
    value.pagina !== Math.min(requestedPage, Math.max(0, Math.ceil(value.total / CASH_PAGE_SIZE) - 1)) ||
    value.transacoes.length !== Math.min(CASH_PAGE_SIZE, Math.max(0, value.total - value.pagina * CASH_PAGE_SIZE))) throw invalid();
  let previous = Infinity;
  for (const row of value.transacoes) {
    if (!object(row) || !count(row.id) || row.id <= 0 || row.id >= previous ||
      !["RECEBIMENTO_CLIENTE", "PAGAMENTO_FUNCIONARIO"].includes(String(row.tipo)) ||
      !amount(row.valor) || typeof row.data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.data) ||
      (row.descricao !== null && typeof row.descricao !== "string") ||
      (row.funcionario_id !== null && (!count(row.funcionario_id) || row.funcionario_id <= 0)) ||
      (row.funcionarios !== null && (!object(row.funcionarios) || typeof row.funcionarios.nome !== "string"))) throw invalid();
    previous = row.id;
  }
  return value as CashPage;
}
