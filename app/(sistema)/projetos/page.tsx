"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase"; // Ajustado para o atalho correto da raiz
import { useDataLoad } from "@/app/hooks/useDataLoad";
import { LoadFeedback } from "@/app/components/LoadFeedback";
import { loadProjectPage, lastProjectPage, PROJECT_PAGE_SIZE, type Projeto, type ProjectPage } from "@/lib/project-pagination";
import Link from "next/link";
import { MutationGuard } from "@/app/components/MutationGuard";
import { useConfirmedMutation } from "@/app/hooks/useConfirmedMutation";
import { MutationError } from "@/lib/confirmed-mutation";
import toast from "react-hot-toast";
import { Building2, Calendar, MapPin, ArrowRight, Edit2, Trash2, Plus, X, Save } from "lucide-react";

export default function Projetos() {
  const { run, isBusy, requiresReload } = useConfirmedMutation();
  const [pagina, setPagina] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<(ProjectPage & { revision: number }) | null>(null);
  const [novoProjeto, setNovoProjeto] = useState("");
  const listHeading = useRef<HTMLHeadingElement>(null);
  const focusAfterLoad = useRef(false);
  const [projetoEditando, setProjetoEditando] = useState<number | null>(null);
  const [tituloEditado, setTituloEditado] = useState("");
  
  const [projetoConfirmarExclusao, setProjetoConfirmarExclusao] = useState<number | null>(null);

  const buscarProjetos = useCallback(async (signal: AbortSignal) => ({
    ...await loadProjectPage(
      (from, to) => supabase.from("projetos").select("id, titulo, user_id, criado_em", { count: "exact" })
        .order("criado_em", { ascending: false }).order("id", { ascending: false }).range(from, to).abortSignal(signal),
      pagina, signal,
    ),
    revision,
  }), [pagina, revision]);
  const aplicarPagina = useCallback((value: ProjectPage & { revision: number }) => {
    setResult(value);
    setPagina(Math.min(value.page, lastProjectPage(value.total)));
  }, []);
  const { loading, ready: loaded, error, retry } = useDataLoad(buscarProjetos, aplicarPagina);
  // Bloqueia dados antigos já no render da troca, antes de o efeito iniciar a leitura.
  const ready = loaded && result?.page === pagina && result.revision === revision;
  const projetos = result?.rows ?? [];
  const total = result?.total ?? 0;
  const carregando = loading || isBusy;
  const ultimaPagina = lastProjectPage(total);
  const temFormularioAberto = projetoEditando !== null || projetoConfirmarExclusao !== null;

  useEffect(() => {
    if (ready && focusAfterLoad.current) {
      listHeading.current?.focus();
      focusAfterLoad.current = false;
    }
  }, [ready]);

  const atualizarLista = (page: number) => {
    focusAfterLoad.current = true;
    setPagina(page);
    setRevision(value => value + 1);
  };

  const criarProjeto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || carregando || temFormularioAberto || requiresReload || !novoProjeto.trim()) return;
    await run({
      key: "projetos",
      loading: "Criando obra...",
      success: "Obra criada com sucesso!",
      request: async signal => {
        const { data: { user }, error } = await supabase.auth.getUser();
        signal.throwIfAborted();
        if (error || !user) throw new MutationError("Não foi possível validar sua sessão. Entre novamente.");
        return supabase.from("projetos").insert([{ titulo: novoProjeto, user_id: user.id }])
          .select("id, titulo, user_id, criado_em").single<Projeto>();
      },
      onConfirmed: () => {
        setNovoProjeto("");
        atualizarLista(0);
      },
    });
  };

  const iniciarEdicao = (projeto: Projeto) => {
    setProjetoEditando(projeto.id);
    setTituloEditado(projeto.titulo);
    setProjetoConfirmarExclusao(null); 
  };

  const salvarEdicao = async (id: number) => {
    if (!tituloEditado.trim()) return toast.error("O nome da obra não pode ficar vazio.");
    await run({
      key: "projetos",
      loading: "Salvando alterações...",
      success: "Nome atualizado!",
      request: () => supabase.from("projetos").update({ titulo: tituloEditado }).eq("id", id)
        .select("id, titulo, user_id, criado_em").single<Projeto>(),
      onConfirmed: (projeto) => {
        setResult(prev => prev && ({ ...prev, rows: prev.rows.map(p => p.id === id ? projeto : p) }));
        setProjetoEditando(null);
      },
    });
  };

  const confirmarExclusaoProjeto = async (id: number) => {
    await run({
      key: "projetos",
      loading: "Excluindo obra...",
      success: "Obra excluída com sucesso!",
      request: () => supabase.from("projetos").delete().eq("id", id)
        .select("id").single<{ id: number }>(),
      onConfirmed: () => {
        setProjetoConfirmarExclusao(null);
        atualizarLista(Math.min(pagina, lastProjectPage(Math.max(0, total - 1))));
      },
    });
  };

  // Função auxiliar para formatar a data que vem do banco
  const formatarData = (dataIso: string) => {
    const data = new Date(dataIso);
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (!ready) return <section>
    <h1 className="text-2xl font-extrabold text-zinc-900">Meus Projetos</h1>
    <LoadFeedback error={error} retry={retry} />
  </section>;

  return (
    <MutationGuard blocked={requiresReload}>
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER E FORMULÁRIO DE CRIAÇÃO */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight">Meus Projetos</h1>
          <p className="text-sm md:text-base text-zinc-500 mt-1">Gerencie e crie novas obras no sistema.</p>
        </div>
        
        <form onSubmit={criarProjeto} className="flex w-full md:w-auto gap-2">
          <label htmlFor="nova-obra" className="sr-only">Nome da nova obra</label>
          <input
            id="nova-obra"
            type="text"
            className="flex-1 md:w-72 p-3 border border-zinc-300 rounded-xl text-zinc-900 outline-none focus:ring-2 focus:ring-orange-500 placeholder-zinc-400 transition-all disabled:opacity-50"
            placeholder="Ex: Reforma da Cozinha..."
            value={novoProjeto}
            onChange={(e) => setNovoProjeto(e.target.value)}
            disabled={carregando || temFormularioAberto}
          />
          <button
            type="submit"
            aria-label="Criar obra"
            disabled={carregando || temFormularioAberto || !novoProjeto.trim()}
            className="bg-zinc-900 text-white px-5 py-3 rounded-xl hover:bg-zinc-800 transition-colors shadow-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Criar</span>
          </button>
        </form>
      </div>

      {/* ÁREA DE DADOS RESPONSIVA */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <h2 ref={listHeading} tabIndex={-1} className="p-4 font-bold text-zinc-900">
          Obras cadastradas — página {pagina + 1} de {ultimaPagina + 1}
        </h2>
        
        {/* CABEÇALHO DA TABELA (Exclusivo Desktop) */}
        <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-zinc-50 border-b border-zinc-100 text-xs uppercase font-semibold text-zinc-500">
          <div className="col-span-5">Detalhes da Obra</div>
          <div className="col-span-3">Progresso Inicial</div>
          <div className="col-span-2">Criação</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>

        {/* ESTADOS DE CARREGAMENTO E VAZIO */}
        {carregando && projetos.length === 0 ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
          </div>
        ) : projetos.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-zinc-100 text-zinc-400 rounded-full flex items-center justify-center mb-4">
              <Building2 size={32} />
            </div>
            <p className="text-zinc-500 text-lg">Nenhuma obra cadastrada ainda.</p>
            <p className="text-zinc-400 text-sm mt-1">Use o campo acima para criar seu primeiro projeto.</p>
          </div>
        ) : (
          /* LISTA DE PROJETOS VINDOS DO SUPABASE */
          <div className="divide-y divide-zinc-100">
            {projetos.map((projeto) => (
              <div key={projeto.id} className={`flex flex-col md:grid md:grid-cols-12 gap-4 p-4 md:items-center transition-colors ${projetoConfirmarExclusao === projeto.id ? "bg-red-50/50" : "hover:bg-zinc-50"}`}>
                
                {/* LÓGICA DE INTERFACE: MODO EDIÇÃO, MODO EXCLUSÃO OU VISUALIZAÇÃO PADRÃO */}
                {projetoEditando === projeto.id ? (
                  /* --- MODO EDIÇÃO --- */
                  <div className="col-span-12 flex flex-col sm:flex-row gap-3 animate-in fade-in">
                    <input
                      type="text"
                      className="flex-1 p-3 border border-orange-300 rounded-xl text-zinc-900 outline-none focus:ring-2 focus:ring-orange-600 bg-orange-50 disabled:opacity-50"
                      value={tituloEditado}
                      onChange={(e) => setTituloEditado(e.target.value)}
                      disabled={carregando}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setProjetoEditando(null)} disabled={carregando} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100 text-zinc-600 font-bold rounded-xl hover:bg-zinc-200 transition">
                        <X size={18} /> Cancelar
                      </button>
                      <button onClick={() => salvarEdicao(projeto.id)} disabled={carregando} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition">
                        <Save size={18} /> Salvar
                      </button>
                    </div>
                  </div>
                ) : projetoConfirmarExclusao === projeto.id ? (
                  /* --- MODO EXCLUSÃO --- */
                  <div className="col-span-12 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in p-2">
                    <p className="text-red-600 font-bold text-sm text-center sm:text-left">
                      Todos os dados de &quot;{projeto.titulo}&quot; serão perdidos. Confirmar exclusão?
                    </p>
                    <div className="flex w-full sm:w-auto gap-2">
                      <button onClick={() => setProjetoConfirmarExclusao(null)} disabled={carregando} className="flex-1 sm:flex-none px-4 py-2 bg-zinc-200 text-zinc-800 font-bold rounded-xl hover:bg-zinc-300 transition">
                        Cancelar
                      </button>
                      <button onClick={() => confirmarExclusaoProjeto(projeto.id)} disabled={carregando} className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition">
                        Sim, Excluir
                      </button>
                    </div>
                  </div>
                ) : (
                  /* --- MODO VISUALIZAÇÃO NORMAL --- */
                  <>
                    {/* Coluna 1: Informações Principais */}
                    <div className="md:col-span-5 flex items-start gap-3">
                      <div className="mt-1 p-2 bg-orange-100 text-orange-600 rounded-lg shrink-0">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-zinc-900 text-lg md:text-base wrap-break-word line-clamp-2">{projeto.titulo}</h3>
                        <div className="flex items-center gap-1 text-sm text-zinc-500 mt-1">
                          <MapPin size={14} />
                          <span>Local a definir</span> {/* Placeholder até criar no BD */}
                        </div>
                      </div>
                    </div>

                    {/* Coluna 2: Progresso (Placeholder visual) */}
                    <div className="md:col-span-3 flex flex-col justify-center">
                      <div className="flex items-center justify-between md:hidden mb-1">
                        <span className="text-sm font-medium text-zinc-700">Progresso Geral</span>
                        <span className="text-sm font-bold text-zinc-900">0%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-zinc-200 rounded-full h-2.5 md:h-2">
                          <div className="h-2.5 md:h-2 rounded-full bg-zinc-300" style={{ width: '0%' }}></div>
                        </div>
                        <span className="hidden md:inline text-sm font-bold text-zinc-500 w-9">0%</span>
                      </div>
                    </div>

                    {/* Coluna 3: Data de Criação real do BD */}
                    <div className="hidden md:flex md:col-span-2 items-center gap-2 text-sm text-zinc-600">
                      <Calendar size={16} className="text-zinc-400" />
                      <span>{formatarData(projeto.criado_em)}</span>
                    </div>

                    {/* Coluna 4: Ações (Abrir, Editar, Excluir) */}
                    <div className="md:col-span-2 flex items-center justify-between md:justify-end gap-2 mt-2 md:mt-0 pt-3 md:pt-0 border-t border-zinc-100 md:border-0">
                      
                      {/* Botões visíveis no mobile e desktop */}
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <button 
                          disabled={carregando || temFormularioAberto} onClick={() => iniciarEdicao(projeto)}
                          className="p-2 text-zinc-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          disabled={carregando || temFormularioAberto} onClick={() => setProjetoConfirmarExclusao(projeto.id)}
                          className="p-2 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                        
                        <Link 
                          href={`/projetos/${projeto.id}`}
                          className="flex flex-1 md:flex-none items-center justify-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-lg transition-colors ml-auto"
                        >
                          Abrir <ArrowRight size={16} />
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <nav aria-label="Paginação das obras" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-sm text-zinc-700" role="status">
          {total === 0 ? "0 obras" : `${pagina * PROJECT_PAGE_SIZE + 1}–${pagina * PROJECT_PAGE_SIZE + projetos.length} de ${total} obras`}
        </p>
        <div className="flex gap-2">
          <button type="button" disabled={carregando || pagina === 0 || temFormularioAberto}
            onClick={() => { focusAfterLoad.current = true; setPagina(pagina - 1); }}
            className="rounded-lg bg-zinc-900 px-4 py-3 font-bold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">Anterior</button>
          <button type="button" disabled={carregando || pagina >= ultimaPagina || temFormularioAberto}
            onClick={() => { focusAfterLoad.current = true; setPagina(pagina + 1); }}
            className="rounded-lg bg-zinc-900 px-4 py-3 font-bold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">Próxima</button>
        </div>
      </nav>
    </div>
    </MutationGuard>
  );
}
