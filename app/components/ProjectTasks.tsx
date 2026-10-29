"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CheckSquare, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { loadPage, lastPage, PAGE_SIZE, type PaginatedRows } from "@/lib/pagination";
import { LoadError } from "@/lib/load-data";
import { useDataLoad } from "@/app/hooks/useDataLoad";
import { useConfirmedMutation } from "@/app/hooks/useConfirmedMutation";
import { usePrivateLocale } from "@/app/hooks/usePrivateLocale";
import { LoadFeedback } from "./LoadFeedback";
import { MutationGuard } from "./MutationGuard";

type Task = { id: number; nome: string; concluida: boolean | null; projeto_id: number };
type Result = PaginatedRows<Task> & { revision: number };

export function ProjectTasks({ projetoId }: { projetoId: string }) {
  const { locale, p } = usePrivateLocale();
  const { run, isBusy, requiresReload } = useConfirmedMutation();
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [draft, setDraft] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const focusAfterLoad = useRef(false);

  const load = useCallback(async (signal: AbortSignal): Promise<Result> => {
    const data = await loadPage<Task>((from, to) => supabase.from("tarefas")
      .select("id, nome, concluida, projeto_id", { count: "exact" }).eq("projeto_id", projetoId)
      .order("criado_em", { ascending: false }).order("id", { ascending: false })
      .range(from, to).abortSignal(signal), page, signal);
    if (data.rows.some(row => typeof row.nome !== "string" ||
      (row.concluida !== null && typeof row.concluida !== "boolean") ||
      String(row.projeto_id) !== projetoId)) {
      throw new LoadError("A lista veio incompleta ou inconsistente. Tente novamente.");
    }
    return { ...data, revision };
  }, [projetoId, page, revision]);
  const apply = useCallback((data: Result) => {
    setResult(data);
    setPage(Math.min(data.page, lastPage(data.total)));
  }, []);
  const { ready: loaded, error, retry } = useDataLoad(load, apply);
  const ready = loaded && result?.page === page && result.revision === revision;
  const blocked = !ready || isBusy || requiresReload;
  const tasks = ready ? result.rows : [];
  const total = result?.total ?? 0;

  useEffect(() => {
    if (ready && focusAfterLoad.current) {
      heading.current?.focus();
      focusAfterLoad.current = false;
    }
  }, [ready]);

  const refresh = (nextPage: number) => {
    focusAfterLoad.current = true;
    setPage(nextPage);
    setRevision(value => value + 1);
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (blocked || !draft.trim()) return;
    await run({
      key: "tarefa",
      loading: "Adicionando tarefa...",
      success: "Tarefa adicionada!",
      request: () => supabase.from("tarefas").insert([{ nome: draft.trim(), projeto_id: projetoId }])
        .select("id, nome, concluida, projeto_id").single<Task>(),
      onConfirmed: () => {
        setDraft("");
        refresh(0);
      },
    });
  };
  const toggle = async (task: Task) => {
    if (blocked) return;
    await run({
      key: "tarefa",
      loading: "Atualizando tarefa...",
      success: "Tarefa atualizada!",
      request: () => supabase.from("tarefas").update({ concluida: !task.concluida })
        .eq("id", task.id).eq("projeto_id", projetoId)
        .select("id, nome, concluida, projeto_id").single<Task>(),
      // Relê também o total: outra sessão pode ter alterado a mesma página.
      onConfirmed: () => refresh(page),
    });
  };

  return <section lang={locale} aria-label={p("Checklist da Obra")}>
    <MutationGuard blocked={requiresReload}>
      <div className="flex max-h-175 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 p-4">
          <CheckSquare size={20} className="text-blue-700" />
          <h2 ref={heading} tabIndex={-1} className="font-bold text-zinc-900">
            {p("Checklist da Obra")} — {p("Página {page} de {total}", { page: page + 1, total: lastPage(total) + 1 })}
          </h2>
        </div>
        <form onSubmit={create} className="flex gap-2 border-b border-zinc-200 p-4">
          <input type="text" value={draft} disabled={blocked}
            aria-label={p("O que precisa ser feito?")} placeholder={p("O que precisa ser feito?")}
            onChange={event => setDraft(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-zinc-400 p-3 text-zinc-900 placeholder-zinc-600 focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-50" />
          <button type="submit" disabled={blocked || !draft.trim()} aria-label={p("Adicionar tarefa")}
            className="min-h-11 rounded-xl bg-zinc-900 px-4 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50">
            <Plus size={20} />
          </button>
        </form>
        {!ready ? <LoadFeedback error={error} retry={retry} /> : <div className="flex-1 overflow-y-auto p-4">
          {tasks.length === 0 ? <p className="py-6 text-center text-zinc-700">{p("Sua lista está vazia.")}</p> :
            <ul className="space-y-2">{tasks.map(task => <li key={task.id}>
              <button type="button" disabled={blocked} aria-pressed={task.concluida === true}
                onClick={() => void toggle(task)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl border p-4 text-left focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-50 ${task.concluida ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-zinc-300 bg-white text-zinc-900"}`}>
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-500">
                  {task.concluida && <Check size={14} strokeWidth={3} />}
                </span>
                <span className={`break-words text-sm font-semibold ${task.concluida ? "line-through" : ""}`}>{task.nome}</span>
              </button>
            </li>)}</ul>}
        </div>}
        <p role="status" className="px-4 text-sm text-zinc-700">
          {ready && p("{from}–{to} de {total} tarefas", {
            from: total ? page * PAGE_SIZE + 1 : 0, to: page * PAGE_SIZE + tasks.length, total,
          })}
        </p>
        <nav aria-label={p("Paginação das tarefas")} className="flex justify-between gap-2 p-4">
          <button type="button" disabled={blocked || page === 0} onClick={() => refresh(page - 1)}
            className="min-h-11 rounded-lg border border-zinc-400 px-3 py-2 font-bold text-zinc-900 disabled:opacity-50">{p("Anterior")}</button>
          <button type="button" disabled={blocked || page >= lastPage(total)} onClick={() => refresh(page + 1)}
            className="min-h-11 rounded-lg border border-zinc-400 px-3 py-2 font-bold text-zinc-900 disabled:opacity-50">{p("Próxima")}</button>
        </nav>
      </div>
    </MutationGuard>
  </section>;
}
