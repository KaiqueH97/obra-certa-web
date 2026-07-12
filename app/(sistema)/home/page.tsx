import Link from "next/link";
import { Building2, AlertCircle, CheckCircle2, DollarSign, Download, Calculator, FolderKanban } from "lucide-react";

export default function HomeDashboard() {
  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER: Título e Botão de Exportação */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight">Resumo da Obra</h1>
          <p className="text-sm md:text-base text-zinc-500">O que vamos fazer hoje?</p>
        </div>
        
        {/* Botão Desktop */}
        <button className="hidden md:flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-xl hover:bg-zinc-800 transition-colors shadow-sm font-medium">
          <Download size={18} />
          Gerar Relatório
        </button>
      </div>

      {/* ACESSO RÁPIDO (Herança do seu design original - Excelente para o mobile) */}
      <div className="flex flex-col md:hidden gap-3">
        <Link 
          href="/calcular" 
          className="flex items-center justify-center gap-2 bg-orange-600 text-white font-bold p-4 rounded-xl text-xl shadow-md hover:bg-orange-700 transition"
        >
          <Calculator size={24} />
          Nova Medição
        </Link>
        <Link 
          href="/projetos" 
          className="flex items-center justify-center gap-2 bg-zinc-800 text-white font-bold p-4 rounded-xl text-xl shadow-md hover:bg-zinc-900 transition"
        >
          <FolderKanban size={24} />
          Meus Projetos
        </Link>
      </div>

      {/* CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2 md:mb-4">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Building2 size={20} />
            </div>
            <span className="text-xs md:text-sm font-semibold text-zinc-500">Obras Ativas</span>
          </div>
          <p className="text-2xl md:text-4xl font-black text-zinc-900">3</p>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2 md:mb-4">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <CheckCircle2 size={20} />
            </div>
            <span className="text-xs md:text-sm font-semibold text-zinc-500">Concluídas</span>
          </div>
          <p className="text-2xl md:text-4xl font-black text-zinc-900">28</p>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2 md:mb-4">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
              <AlertCircle size={20} />
            </div>
            <span className="text-xs md:text-sm font-semibold text-zinc-500">Faltando</span>
          </div>
          <p className="text-2xl md:text-4xl font-black text-orange-600">5</p>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2 md:mb-4">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <DollarSign size={20} />
            </div>
            <span className="text-xs md:text-sm font-semibold text-zinc-500">Previsto</span>
          </div>
          <p className="text-xl md:text-3xl font-black text-zinc-900">R$ 14.5k</p>
        </div>
      </div>

      {/* ÁREA DE GRÁFICOS E TABELAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Tabela de Projetos */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-zinc-100">
            <h2 className="text-lg font-bold text-zinc-900">Andamento dos Projetos</h2>
          </div>
          
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-600">
              <thead className="hidden md:table-header-group bg-zinc-50 text-xs uppercase font-semibold text-zinc-500">
                <tr>
                  <th className="px-6 py-4">Nome da Obra</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Progresso</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 flex flex-col md:table-row-group">
                <tr className="flex flex-col md:table-row p-4 md:p-0 hover:bg-zinc-50 transition-colors">
                  <td className="px-2 md:px-6 py-2 md:py-4 font-medium text-zinc-900">Reforma Fatec Lab</td>
                  <td className="px-2 md:px-6 py-1 md:py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      Em dia
                    </span>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4">
                    <div className="w-full bg-zinc-200 rounded-full h-2 mt-2 md:mt-0 max-w-[120px]">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                    </div>
                  </td>
                  <td className="px-2 md:px-6 py-2 md:py-4 md:text-right">
                    <button className="text-orange-600 hover:text-orange-800 font-medium text-xs md:text-sm">Ver detalhes</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Alertas Recentes */}
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-4">Avisos do Canteiro</h2>
          <div className="space-y-4">
            <div className="flex gap-3 items-start border-l-2 border-orange-500 pl-3">
              <div className="mt-0.5 text-orange-600">
                <AlertCircle size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">Cimento acabando</p>
                <p className="text-xs text-zinc-500 mt-1">Obra: Reforma Fatec Lab. Restam apenas 2 sacos.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}