"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { loadPage, lastPage, PAGE_SIZE, type PaginatedRows } from "@/lib/pagination";
import { formatBRL } from "@/lib/private-i18n";
import { LoadError } from "@/lib/load-data";
import { useDataLoad } from "@/app/hooks/useDataLoad";
import { usePrivateLocale } from "@/app/hooks/usePrivateLocale";
import { LoadFeedback } from "@/app/components/LoadFeedback";

export type WorkerOption = { id: number; nome: string; valor_diaria: number | null };
type Result = PaginatedRows<WorkerOption> & { search: string };

type Props = {
  id: string;
  selected: WorkerOption | null;
  onSelect: (worker: WorkerOption | null) => void;
  disabled?: boolean;
};

export function WorkerPicker({ id, selected, onSelect, disabled = false }: Props) {
  const { locale, p } = usePrivateLocale();
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const load = useCallback(async (signal: AbortSignal): Promise<Result> => {
    const data = await loadPage<WorkerOption>((from, to) => {
      let query = supabase.from("funcionarios").select("id, nome, valor_diaria", { count: "exact" });
      // Filtro de uma coluna via SDK: não concatena uma expressão .or().
      if (search) query = query.ilike("nome", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
      return query.order("nome", { ascending: true }).order("id", { ascending: true })
        .range(from, to).abortSignal(signal);
    }, page, signal);
    if (data.rows.some(row => typeof row.nome !== "string" || (row.valor_diaria !== null && (typeof row.valor_diaria !== "number" || !Number.isFinite(row.valor_diaria) || row.valor_diaria < 0)))) {
      throw new LoadError("A lista veio incompleta ou inconsistente. Tente novamente.");
    }
    return { ...data, search };
  }, [page, search]);
  const apply = useCallback((data: Result) => {
    setResult(data);
    setPage(Math.min(data.page, lastPage(data.total)));
  }, []);
  const { ready: loaded, error, retry } = useDataLoad(load, apply);
  // Não deixa selecionar itens da consulta anterior no render antes do efeito.
  const ready = loaded && result?.page === page && result.search === search;
  const rows = ready ? result.rows : [];

  const searchWorkers = () => {
    if (disabled) return;
    const next = draft.trim();
    if (next === search && page === 0) { void retry(); return; }
    setSearch(next);
    setPage(0);
  };
  const optionText = (worker: WorkerOption) => `${worker.nome} (${p("Diária")}: ${formatBRL(locale, worker.valor_diaria ?? 0)})`;
  return <fieldset disabled={disabled} lang={locale} className="mb-4 min-w-0 space-y-3">
    <div className="space-y-2">
      <label htmlFor={`${id}-search`} className="block text-sm font-bold text-zinc-900">{p("Buscar profissional pelo nome")}</label>
      <div className="flex gap-2">
        <input id={`${id}-search`} type="search" value={draft} maxLength={120} disabled={disabled}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              searchWorkers();
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-zinc-400 p-3 text-zinc-900 focus-visible:outline-2 focus-visible:outline-orange-600" />
        <button type="button" onClick={searchWorkers} disabled={disabled} className="min-h-11 rounded-lg bg-zinc-900 px-4 py-3 font-bold text-white disabled:opacity-50">{p("Buscar")}</button>
      </div>
    </div>
    {selected && <p className="break-words text-sm text-zinc-700">{p("Profissional selecionado: {name}", { name: selected.nome })}</p>}
    {!ready && <LoadFeedback error={error} retry={retry} />}
    <label htmlFor={id} className="block text-sm font-bold text-zinc-900">{p("Profissional")}</label>
    <select required id={id} value={selected?.id ?? ""} disabled={disabled || !ready}
      aria-describedby={`${id}-status`}
      onChange={event => {
        const value = event.target.value;
        if (!value) { onSelect(null); return; }
        const worker = rows.find(row => row.id.toString() === value);
        if (worker) onSelect(worker);
      }}
      className="w-full rounded-xl border border-zinc-300 bg-zinc-50 p-4 font-medium text-zinc-900 focus-visible:outline-2 focus-visible:outline-orange-600 disabled:opacity-50">
      <option value="">{p("Selecione o profissional...")}</option>
      {selected && <option value={selected.id}>{optionText(selected)}</option>}
      {rows.filter(row => row.id !== selected?.id).map(row => <option key={row.id} value={row.id}>{optionText(row)}</option>)}
    </select>
    <p id={`${id}-status`} role="status" className="text-sm text-zinc-700">
      {ready ? result.total === 0 ? p("Nenhum profissional encontrado nesta busca.")
        : p("{from}–{to} de {total} profissionais", { from: page * PAGE_SIZE + 1, to: page * PAGE_SIZE + rows.length, total: result.total })
        : ""}
    </p>
    <nav aria-label={p("Paginação da equipe")} className="flex flex-wrap justify-between gap-2">
      <button type="button" disabled={disabled || !ready || page === 0}
        onClick={() => setPage(value => value - 1)}
        className="min-h-11 rounded-lg border border-zinc-400 px-3 py-2 font-bold text-zinc-900 disabled:opacity-50">{p("Anterior")}</button>
      <button type="button" disabled={disabled || !ready || page >= lastPage(result?.total ?? 0)}
        onClick={() => setPage(value => value + 1)}
        className="min-h-11 rounded-lg border border-zinc-400 px-3 py-2 font-bold text-zinc-900 disabled:opacity-50">{p("Próxima")}</button>
    </nav>
  </fieldset>;
}
