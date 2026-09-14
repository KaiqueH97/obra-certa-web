import { LoadError } from "./load-data";

export type DashboardSummary = {
  projetos: { id: number; titulo: string; criado_em: string }[];
  metricas: {
    obrasAtivas: number;
    tarefasConcluidas: number;
    tarefasPendentes: number;
    custoTotal: number;
  };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

// Não transforma um contrato incompleto em indicadores zerados.
export function parseDashboardSummary(value: unknown): DashboardSummary {
  const invalid = () => new LoadError("Não foi possível confirmar o resumo das obras. Tente novamente.");
  if (!isObject(value) || !isObject(value.metricas) || !Array.isArray(value.projetos)) throw invalid();
  const { metricas, projetos } = value;
  if (!isCount(metricas.obrasAtivas) || !isCount(metricas.tarefasConcluidas) ||
    !isCount(metricas.tarefasPendentes) || typeof metricas.custoTotal !== "number" ||
    !Number.isFinite(metricas.custoTotal) || projetos.length !== Math.min(4, metricas.obrasAtivas)) throw invalid();

  const ids = new Set<number>();
  const recent = projetos.map(projeto => {
    if (!isObject(projeto) || !isCount(projeto.id) || projeto.id === 0 || ids.has(projeto.id) ||
      typeof projeto.titulo !== "string" || typeof projeto.criado_em !== "string" ||
      !Number.isFinite(Date.parse(projeto.criado_em))) throw invalid();
    ids.add(projeto.id);
    return { id: projeto.id, titulo: projeto.titulo, criado_em: projeto.criado_em };
  });
  return {
    projetos: recent,
    metricas: {
      obrasAtivas: metricas.obrasAtivas,
      tarefasConcluidas: metricas.tarefasConcluidas,
      tarefasPendentes: metricas.tarefasPendentes,
      custoTotal: metricas.custoTotal,
    },
  };
}
