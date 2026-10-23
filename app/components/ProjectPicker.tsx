"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { loadPage, lastPage, PAGE_SIZE, type PaginatedRows } from "@/lib/pagination";
import { LoadError } from "@/lib/load-data";
import { useDataLoad } from "@/app/hooks/useDataLoad";
import { usePrivateLocale } from "@/app/hooks/usePrivateLocale";
import { LoadFeedback } from "@/app/components/LoadFeedback";

export type ProjectOption = { id: number; titulo: string };
type Result = PaginatedRows<ProjectOption> & { search: string };

type Props = {
  id: string;
  selected: ProjectOption | null;
  onSelect: (project: ProjectOption | null) => void;
  disabled?: boolean;
};

export function ProjectPicker({ id, selected, onSelect, disabled = false }: Props) {
  const { locale, p } = usePrivateLocale();
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const load = useCallback(async (signal: AbortSignal): Promise<Result> => {
    const data = await loadPage<ProjectOption>((from, to) => {
      let query = supabase.from("projetos").select("id, titulo", { count: "exact" });
      // Filtro de uma coluna via SDK: não concatena uma expressão .or().
      if (search) query = query.ilike("titulo", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
      return query.order("criado_em", { ascending: false }).order("id", { ascending: false })
        .range(from, to).abortSignal(signal);
    }, page, signal);
    if (data.rows.some(row => typeof row.titulo !== "string")) {
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

  return <fieldset disabled={disabled} lang={locale} className="mb-4 min-w-0 space-y-3">
    <form onSubmit={event => {
      event.preventDefault();
      if (disabled) return;
      const next = draft.trim();
      if (next === search && page === 0) { void retry(); return; }
      setSearch(next);
      setPage(0);
    }} className="space-y-2">
      <label htmlFor={`${id}-search`} className="block text-sm font-bold text-zinc-900">{p("Buscar obra pelo nome")}</label>
      <div className="flex gap-2">
        <input id={`${id}-search`} type="search" value={draft} maxLength={120} disabled={disabled}
          onChange={event => setDraft(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-zinc-400 p-3 text-zinc-900 focus-visible:outline-2 focus-visible:outline-orange-600" />
        <button type="submit" disabled={disabled} className="min-h-11 rounded-lg bg-zinc-900 px-4 py-3 font-bold text-white disabled:opacity-50">{p("Buscar")}</button>
      </div>
    </form>
    {selected && <p className="break-words text-sm text-zinc-700">{p("Obra selecionada: {name}", { name: selected.titulo })}</p>}
    {!ready && <LoadFeedback error={error} retry={retry} />}
    <select id={id} value={selected?.id ?? ""} disabled={disabled || !ready}
      aria-describedby={`${id}-status`}
      onChange={event => {
        const value = event.target.value;
        if (!value) { onSelect(null); return; }
        const project = rows.find(row => row.id.toString() === value);
        if (project) onSelect(project);
      }}
      className="w-full rounded-xl border border-zinc-300 bg-zinc-50 p-4 font-medium text-zinc-900 focus-visible:outline-2 focus-visible:outline-orange-600 disabled:opacity-50">
      <option value="">{p("Selecione um projeto...")}</option>
      {selected && <option value={selected.id}>{selected.titulo}</option>}
      {rows.filter(row => row.id !== selected?.id).map(row => <option key={row.id} value={row.id}>{row.titulo}</option>)}
    </select>
    <p id={`${id}-status`} role="status" className="text-sm text-zinc-700">
      {ready ? result.total === 0 ? p("Nenhuma obra encontrada nesta busca.")
        : p("{from}–{to} de {total} obras", { from: page * PAGE_SIZE + 1, to: page * PAGE_SIZE + rows.length, total: result.total })
        : ""}
    </p>
    <nav aria-label={p("Paginação das obras")} className="flex flex-wrap justify-between gap-2">
      <button type="button" disabled={disabled || !ready || page === 0}
        onClick={() => setPage(value => value - 1)}
        className="min-h-11 rounded-lg border border-zinc-400 px-3 py-2 font-bold text-zinc-900 disabled:opacity-50">{p("Anterior")}</button>
      <button type="button" disabled={disabled || !ready || page >= lastPage(result?.total ?? 0)}
        onClick={() => setPage(value => value + 1)}
        className="min-h-11 rounded-lg border border-zinc-400 px-3 py-2 font-bold text-zinc-900 disabled:opacity-50">{p("Próxima")}</button>
    </nav>
  </fieldset>;
}
