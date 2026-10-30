"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createDataLoader, requireData, type LoadState } from "@/lib/load-data";
import { parseMaterialQuote, type QuoteMaterial } from "@/lib/materials-page";
import { materialQuote } from "@/lib/private-i18n";
import { usePrivateLocale } from "@/app/hooks/usePrivateLocale";

export function MaterialQuote({ projectId, worker, project, phone, disabled }: {
  projectId: string; worker: string; project: string; phone: string; disabled: boolean;
}) {
  const { locale, p, message } = usePrivateLocale();
  const [state, setState] = useState<LoadState>({ status: "ready", error: null });
  const [rows, setRows] = useState<QuoteMaterial[] | null>(null);
  const [loader] = useState(() => createDataLoader(setState));
  const busy = useRef(false);
  useEffect(() => {
    loader.activate();
    return () => loader.cancel();
  }, [loader]);
  const prepare = async () => {
    if (disabled || busy.current) return;
    busy.current = true;
    setRows(null);
    try {
      await loader.run(async signal => parseMaterialQuote(requireData(
        await supabase.rpc("cotacao_materiais", { p_projeto_id: projectId }).abortSignal(signal),
      ), projectId), setRows);
    } finally { busy.current = false; }
  };
  const text = rows ? materialQuote(locale, { worker, project, phone, materials: rows }) : "";
  return <div lang={locale} className="w-full space-y-3 lg:max-w-md">
    <button type="button" onClick={() => void prepare()} disabled={disabled || state.status === "loading"}
      className="min-h-11 rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white disabled:opacity-50">
      {p("Preparar cotação completa")}
    </button>
    {state.status === "loading" && <p role="status">{p("Carregando cotação...")}</p>}
    {state.error && <p role="alert" className="text-red-800">{message(state.error).text}</p>}
    {rows && !disabled && <>
      <p role="status" className="text-sm text-zinc-700">{p("{total} materiais na cotação.", { total: rows.length })}</p>
      <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
        className="inline-block rounded-lg bg-emerald-800 px-4 py-3 font-bold text-white">{p("Abrir cotação no WhatsApp")}</a>
      <label className="block text-sm font-bold text-zinc-900">
        {p("Texto completo da cotação")}
        <textarea readOnly value={text} className="mt-2 h-28 w-full rounded-lg border border-zinc-400 p-2 font-normal" />
      </label>
    </>}
  </div>;
}
