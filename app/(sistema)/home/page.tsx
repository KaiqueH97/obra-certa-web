"use client";

import { formatBRL } from "@/lib/private-i18n";
import { usePrivateLocale } from "@/app/hooks/usePrivateLocale";

import { useCallback, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useDataLoad } from "@/app/hooks/useDataLoad";
import { LoadFeedback } from "@/app/components/LoadFeedback";
import { requireData } from "@/lib/load-data";
import { parseDashboardSummary, type DashboardSummary } from "@/lib/dashboard";
import { Building2, AlertCircle, CheckCircle2, DollarSign, Download, Calculator, FolderKanban, ArrowRight, Users } from "lucide-react";

export default function HomeDashboard() {
  const { locale, p } = usePrivateLocale();
  const [resumo, setResumo] = useState<DashboardSummary | null>(null);
  const carregarDashboard = useCallback(async (signal: AbortSignal) => {
    const response = await supabase.rpc("resumo_dashboard").abortSignal(signal);
    return parseDashboardSummary(requireData(response));
  }, []);
  const { loading: carregando, ready, error, retry } = useDataLoad(carregarDashboard, setResumo);

  if (!ready || !resumo) return <section lang={locale}>
    <h1 className="text-2xl font-extrabold text-zinc-900">{p("Resumo da Obra")}</h1>
    <LoadFeedback error={error} retry={retry} />
  </section>;

  const { projetos, metricas } = resumo;

  return (
    <div lang={locale} className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight">{p("Resumo da Obra")}</h1>
          <p className="text-sm md:text-base text-zinc-500">{p("Resumo dos seus canteiros no momento da consulta.")}</p>
        </div>
        
        <button className="hidden md:flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-xl hover:bg-zinc-800 transition-colors shadow-sm font-medium">
          <Download size={18} />
          {p("Gerar Relatório")}
        </button>
      </div>

      {/* ACESSO RÁPIDO (Mobile) */}
      <div className="flex flex-col md:hidden gap-3">
        <Link href="/calcular" className="flex items-center justify-center gap-2 bg-orange-600 text-white font-bold p-4 rounded-xl text-xl shadow-md hover:bg-orange-700 transition">
          <Calculator size={24} />
          {p("Nova Medição")}
        </Link>
        <Link href="/projetos" className="flex items-center justify-center gap-2 bg-zinc-800 text-white font-bold p-4 rounded-xl text-xl shadow-md hover:bg-zinc-900 transition">
          <FolderKanban size={24} />
          {p("Meus Projetos")}
        </Link>
        <Link href="/equipe" className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold p-4 rounded-xl text-lg shadow-sm hover:bg-emerald-700 transition">
          <Users size={24} />
          {p("Minha Equipe")}
        </Link>
      </div>

      {/* CARDS DE MÉTRICAS REAIS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-zinc-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2 md:mb-4">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Building2 size={20} /></div>
            <span className="text-xs md:text-sm font-semibold text-zinc-500">{p("Obras Cadastradas")}</span>
          </div>
          {carregando ? <div className="h-10 w-16 bg-zinc-100 animate-pulse rounded"></div> : <p className="text-2xl md:text-4xl font-black text-zinc-900">{metricas.obrasAtivas}</p>}
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2 md:mb-4">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><CheckCircle2 size={20} /></div>
            <span className="text-xs md:text-sm font-semibold text-zinc-500">{p("Tarefas OK")}</span>
          </div>
          {carregando ? <div className="h-10 w-16 bg-zinc-100 animate-pulse rounded"></div> : <p className="text-2xl md:text-4xl font-black text-zinc-900">{metricas.tarefasConcluidas}</p>}
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2 md:mb-4">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><AlertCircle size={20} /></div>
            <span className="text-xs md:text-sm font-semibold text-zinc-500">{p("Pendentes")}</span>
          </div>
          {carregando ? <div className="h-10 w-16 bg-zinc-100 animate-pulse rounded"></div> : <p className="text-2xl md:text-4xl font-black text-orange-600">{metricas.tarefasPendentes}</p>}
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2 md:mb-4">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><DollarSign size={20} /></div>
            <span className="text-xs md:text-sm font-semibold text-zinc-500">{p("Custo de Materiais")}</span>
          </div>
          {carregando ? <div className="h-10 w-32 bg-zinc-100 animate-pulse rounded"></div> : <p className="text-xl md:text-3xl font-black text-zinc-900">{formatBRL(locale, metricas.custoTotal)}</p>}
        </div>
      </div>

      {/* ÁREA DE TABELAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Tabela de Projetos Recentes */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-zinc-900">{p("Projetos Recentes")}</h2>
            <Link href="/projetos" className="text-sm font-semibold text-orange-600 hover:underline">{p("Ver todos")}</Link>
          </div>
          
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="hidden md:table-header-group bg-zinc-50 text-xs uppercase font-semibold text-zinc-500">
                <tr>
                  <th className="px-6 py-4">{p("Nome da Obra")}</th>
                  <th className="px-6 py-4">{p("Status")}</th>
                  <th className="px-6 py-4 text-right">{p("Ação")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 flex flex-col md:table-row-group">
                {carregando ? (
                  <tr className="flex md:table-row p-4"><td colSpan={3} className="text-center py-4 text-zinc-400">{p("Carregando...")}</td></tr>
                ) : projetos.length === 0 ? (
                  <tr className="flex md:table-row p-4"><td colSpan={3} className="text-center py-4 text-zinc-400">{p("Nenhum projeto encontrado.")}</td></tr>
                ) : (
                  projetos.map((projeto) => (
                    <tr key={projeto.id} className="flex flex-col md:table-row p-4 md:p-0 hover:bg-zinc-50 transition-colors">
                      <td className="px-2 md:px-6 py-2 md:py-4 font-medium text-zinc-900 truncate max-wxs">{projeto.titulo}</td>
                      <td className="px-2 md:px-6 py-1 md:py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          {p("Em andamento")}
                        </span>
                      </td>
                      <td className="px-2 md:px-6 py-2 md:py-4 md:text-right">
                        <Link href={`/projetos/${projeto.id}`} className="text-orange-600 hover:text-orange-800 font-medium text-xs md:text-sm flex items-center gap-1 md:justify-end">
                          {p("Abrir")} <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alertas Recentes dinâmicos */}
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4">{p("Avisos do Sistema")}</h2>
          <div className="space-y-4">
            {metricas.tarefasPendentes > 0 ? (
              <div className="flex gap-3 items-start border-l-2 border-orange-500 pl-3">
                <div className="mt-0.5 text-orange-600"><AlertCircle size={18} /></div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{p("Tarefas Pendentes")}</p>
                  <p className="text-xs text-zinc-500 mt-1">{p("Você tem {count} tarefas pendentes em suas obras. Não esqueça de dar baixa!", { count: metricas.tarefasPendentes })}</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 items-start border-l-2 border-emerald-500 pl-3">
                <div className="mt-0.5 text-emerald-600"><CheckCircle2 size={18} /></div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{p("Tudo em dia!")}</p>
                  <p className="text-xs text-zinc-500 mt-1">{p("Nenhuma tarefa pendente no momento.")}</p>
                </div>
              </div>
            )}
            {metricas.obrasAtivas === 0 && (
              <div className="flex gap-3 items-start border-l-2 border-blue-500 pl-3 mt-4">
                <div className="mt-0.5 text-blue-600"><Building2 size={18} /></div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{p("Bem-vindo!")}</p>
                  <p className="text-xs text-zinc-500 mt-1">{p("Crie seu primeiro projeto para começar a calcular materiais.")}</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
