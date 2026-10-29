"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { requireData } from "@/lib/load-data";
import { parseCashPage, type CashPage } from "@/lib/cash-page";
import { useDataLoad } from "./useDataLoad";

type Result = CashPage & { revision: number; requestedPage: number };

export function useCashPage(projectId: string) {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const load = useCallback(async (signal: AbortSignal): Promise<Result> => {
    const response = await supabase.rpc("pagina_caixa", { p_projeto_id: projectId, p_pagina: page }).abortSignal(signal);
    return { ...parseCashPage(requireData(response), projectId, page), revision, requestedPage: page };
  }, [projectId, page, revision]);
  const apply = useCallback((data: Result) => setResult(data), []);
  const { ready: loaded, error, retry } = useDataLoad(load, apply);
  // A RPC já ajusta uma página removida sem precisar de outra consulta.
  const ready = loaded && result?.requestedPage === page && result.revision === revision &&
    result.projeto_id === Number(projectId);
  const refresh = (nextPage: number) => {
    setPage(nextPage);
    setRevision(value => value + 1);
  };
  return { ready, error, retry, refresh, data: ready ? result : null };
}
