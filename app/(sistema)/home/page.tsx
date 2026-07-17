"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Building2, AlertCircle, CheckCircle2, DollarSign, Download, Calculator, FolderKanban, ArrowRight, Users } from "lucide-react";

// Tipagens para os dados que vamos buscar
interface ProjetoResumo {
  id: number;
  titulo: string;
  criado_em: string;
}

interface Metricas {
  obrasAtivas: number;
  tarefasConcluidas: number;
  tarefasPendentes: number;
  custoTotal: number;
}

export default function HomeDashboard() {
  const [projetos, setProjetos] = useState<ProjetoResumo[]>([]);
  const [metricas, setMetricas] = useState<Metricas>({
    obrasAtivas: 0,
    tarefasConcluidas: 0,
    tarefasPendentes: 0,
    custoTotal: 0
  });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const carregarDashboard = async () => {
      setCarregando(true);

      // 1. Busca os projetos mais recentes
      const { data: projetosData } = await supabase
        .from("projetos")
        .select("id, titulo, criado_em")
        .order("criado_em", { ascending: false });

      // 2. Busca todas as tarefas para calcular produtividade
      const { data: tarefasData } = await supabase
        .from("tarefas")
        .select("concluida, nome");

      // 3. Busca os custos de todos os materiais
      const { data: materiaisData } = await supabase
        .from("materiais_projeto")
        .select("preco_total");

      // Realiza os cálculos
      const obrasAtivas = projetosData?.length || 0;
      const concluidas = tarefasData?.filter(t => t.concluida).length || 0;
      const pendentes = tarefasData?.filter(t => !t.concluida).length || 0;
      const custo = materiaisData?.reduce((acc, item) => {
        const valor = typeof item.preco_total === 'string' ? parseFloat(item.preco_total) : item.preco_total;
        return acc + (valor || 0);
      }, 0) || 0;

      // Atualiza os estados
      setProjetos(projetosData?.slice(0, 4) || []); // Pega apenas os 4 últimos para a tabela
      setMetricas({
        obrasAtivas,
        tarefasConcluidas: concluidas,
        tarefasPendentes: pendentes,
        custoTotal: custo
      });

      setCarregando(false);
    };

    carregarDashboard();
  }, []);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight">Resumo da Obra</h1>
          <p className="text-sm md:text-base text-zinc-500">Acompanhamento em tempo real dos seus canteiros.</p>
        </div>
        
        <button className="hidden md:flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-xl hover:bg-zinc-800 transition-colors shadow-sm font-medium">
          <Download size={18} />
          Gerar Relatório
        </button>
      </div>

      {/* ACESSO RÁPIDO (Mobile) */}
      <div className="flex flex-col md:hidden gap-3">
        <Link href="/calcular" className="flex items-center justify-center gap-2 bg-orange-600 text-white font-bold p-4 rounded-xl text-xl shadow-md hover:bg-orange-700 transition">
          <Calculator size={24} />
          Nova Medição
        </Link>
        <Link href="/projetos" className="flex items-center justify-center gap-2 bg-zinc-800 text-white font-bold p-4 rounded-xl text-xl shadow-md hover:bg-zinc-900 transition">
          <FolderKanban size={24} />
          Meus Projetos
        </Link>
        <Link href="/equipe" className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold p-4 rounded-xl text-lg shadow-sm hover:bg-emerald-700 transition">
          <Users size={24} />
          Minha Equipe
        </Link>
      </div>

      {/* CARDS DE MÉTRICAS REAIS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-zinc-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2 md:mb-4">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Building2 size={20} /></div>
            <span className="text-xs md:text-sm font-semibold text-zinc-500">Obras Ativas</span>
          </div>
          {carregando ? <div className="h-10 w-16 bg-zinc-100 animate-pulse rounded"></div> : <p className="text-2xl md:text-4xl font-black text-zinc-900">{metricas.obrasAtivas}</p>}
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2 md:mb-4">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><CheckCircle2 size={20} /></div>
            <span className="text-xs md:text-sm font-semibold text-zinc-500">Tarefas OK</span>
          </div>
          {carregando ? <div className="h-10 w-16 bg-zinc-100 animate-pulse rounded"></div> : <p className="text-2xl md:text-4xl font-black text-zinc-900">{metricas.tarefasConcluidas}</p>}
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2 md:mb-4">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><AlertCircle size={20} /></div>
            <span className="text-xs md:text-sm font-semibold text-zinc-500">Pendentes</span>
          </div>
          {carregando ? <div className="h-10 w-16 bg-zinc-100 animate-pulse rounded"></div> : <p className="text-2xl md:text-4xl font-black text-orange-600">{metricas.tarefasPendentes}</p>}
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2 md:mb-4">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><DollarSign size={20} /></div>
            <span className="text-xs md:text-sm font-semibold text-zinc-500">Custo Total</span>
          </div>
          {carregando ? <div className="h-10 w-32 bg-zinc-100 animate-pulse rounded"></div> : <p className="text-xl md:text-3xl font-black text-zinc-900">R$ {metricas.custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>}
        </div>
      </div>

      {/* ÁREA DE TABELAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Tabela de Projetos Recentes */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-zinc-900">Projetos Recentes</h2>
            <Link href="/projetos" className="text-sm font-semibold text-orange-600 hover:underline">Ver todos</Link>
          </div>
          
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="hidden md:table-header-group bg-zinc-50 text-xs uppercase font-semibold text-zinc-500">
                <tr>
                  <th className="px-6 py-4">Nome da Obra</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 flex flex-col md:table-row-group">
                {carregando ? (
                  <tr className="flex md:table-row p-4"><td colSpan={3} className="text-center py-4 text-zinc-400">Carregando...</td></tr>
                ) : projetos.length === 0 ? (
                  <tr className="flex md:table-row p-4"><td colSpan={3} className="text-center py-4 text-zinc-400">Nenhum projeto encontrado.</td></tr>
                ) : (
                  projetos.map((projeto) => (
                    <tr key={projeto.id} className="flex flex-col md:table-row p-4 md:p-0 hover:bg-zinc-50 transition-colors">
                      <td className="px-2 md:px-6 py-2 md:py-4 font-medium text-zinc-900 truncate max-wxs">{projeto.titulo}</td>
                      <td className="px-2 md:px-6 py-1 md:py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          Em andamento
                        </span>
                      </td>
                      <td className="px-2 md:px-6 py-2 md:py-4 md:text-right">
                        <Link href={`/projetos/${projeto.id}`} className="text-orange-600 hover:text-orange-800 font-medium text-xs md:text-sm flex items-center gap-1 md:justify-end">
                          Abrir <ArrowRight size={14} />
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
          <h2 className="text-lg font-bold text-zinc-900 mb-4">Avisos do Sistema</h2>
          <div className="space-y-4">
            {metricas.tarefasPendentes > 0 ? (
              <div className="flex gap-3 items-start border-l-2 border-orange-500 pl-3">
                <div className="mt-0.5 text-orange-600"><AlertCircle size={18} /></div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Tarefas Atrasadas</p>
                  <p className="text-xs text-zinc-500 mt-1">Você tem {metricas.tarefasPendentes} tarefas pendentes em suas obras. Não esqueça de dar baixa!</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 items-start border-l-2 border-emerald-500 pl-3">
                <div className="mt-0.5 text-emerald-600"><CheckCircle2 size={18} /></div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Tudo em dia!</p>
                  <p className="text-xs text-zinc-500 mt-1">Nenhuma tarefa pendente no momento.</p>
                </div>
              </div>
            )}
            {metricas.obrasAtivas === 0 && (
              <div className="flex gap-3 items-start border-l-2 border-blue-500 pl-3 mt-4">
                <div className="mt-0.5 text-blue-600"><Building2 size={18} /></div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Bem-vindo!</p>
                  <p className="text-xs text-zinc-500 mt-1">Crie seu primeiro projeto para começar a calcular materiais.</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}