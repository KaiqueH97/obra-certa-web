"use client";

import { usePrivateLocale } from "@/app/hooks/usePrivateLocale";
import { formatBRL } from "@/lib/private-i18n";

import { useState, useCallback, useRef, useEffect, useId } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase"; 
import { useDataLoad } from "@/app/hooks/useDataLoad";
import { LoadFeedback } from "@/app/components/LoadFeedback";
import { useMaterialsPage } from "@/app/hooks/useMaterialsPage";
import { MATERIALS_PAGE_SIZE, type Material } from "@/lib/materials-page";
import { MaterialQuote } from "@/app/components/MaterialQuote";
import { useCashPage } from "@/app/hooks/useCashPage";
import { CASH_PAGE_SIZE, type CashTransaction } from "@/lib/cash-page";
import { ProjectTasks } from "@/app/components/ProjectTasks";
import { WorkerPicker, type WorkerOption } from "@/app/components/WorkerPicker";
import { DeleteConfirmation } from "@/app/components/DeleteConfirmation";
import { requireData, LoadError } from "@/lib/load-data";
import Link from "next/link";
import { MutationGuard } from "@/app/components/MutationGuard";
import { useConfirmedMutation } from "@/app/hooks/useConfirmedMutation";
import { parseMoney } from "@/lib/money";
import toast from "react-hot-toast";
import { 
  ArrowLeft, ShoppingCart, CheckSquare,
  Edit2, Trash2, Plus, Calculator, X, Save,
  TrendingUp, TrendingDown, Wallet, Users
} from "lucide-react";

export default function ProjetoPage() {
  const { id } = useParams<{ id: string }>();
  return <DetalhesDoProjeto key={id} projetoId={id} />;
}

function DetalhesDoProjeto({ projetoId }: { projetoId: string }) {
  const { locale, p, message } = usePrivateLocale();
  const notice = (text: string) => locale === "pt-BR" ? text : <span lang={message(text).lang}>{message(text).text}</span>;
  const { run, isPending, requiresReload } = useConfirmedMutation();
  const [precosEditados, setPrecosEditados] = useState<Record<number, string>>({});
  const [tituloObra, setTituloObra] = useState("Carregando...");
  const listaMateriais = useMaterialsPage(projetoId);
  const materiais = listaMateriais.data?.materiais ?? [];
  const materiaisPagina = listaMateriais.data?.pagina ?? 0;
  const materiaisTotal = listaMateriais.data?.total ?? 0;
  const materiaisHeading = useRef<HTMLHeadingElement>(null);
  const focoMateriais = useRef(false);
  useEffect(() => {
    if (listaMateriais.ready && focoMateriais.current) {
      materiaisHeading.current?.focus();
      focoMateriais.current = false;
    }
  }, [listaMateriais.ready]);
  const atualizarMateriais = (pagina: number) => {
    focoMateriais.current = true;
    listaMateriais.refresh(pagina);
  };
  const [materialExcluindo, setMaterialExcluindo] = useState<number | null>(null);
  const exclusaoTrigger = useRef<HTMLButtonElement | null>(null);
  
  // Agora temos 3 abas
  const [abaAtiva, setAbaAtiva] = useState<"materiais" | "tarefas" | "caixa">("materiais");
  
  const [materialEditando, setMaterialEditando] = useState<number | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [qtdEditada, setQtdEditada] = useState("");
  const botoesEditar = useRef<Record<number, HTMLButtonElement | null>>({});
  const restaurarEdicao = useRef<number | null>(null);
  useEffect(() => {
    if (materialEditando === null && restaurarEdicao.current !== null) {
      botoesEditar.current[restaurarEdicao.current]?.focus();
      restaurarEdicao.current = null;
    }
  }, [materialEditando]);

  
  const [nomeProfissional, setNomeProfissional] = useState("");
  const [telefoneContato, setTelefoneContato] = useState("");

  // Novos estados financeiros
  const [transacaoExcluindo, setTransacaoExcluindo] = useState<number | null>(null);
  const transacaoTrigger = useRef<HTMLButtonElement | null>(null);
  const caixaHeading = useRef<HTMLHeadingElement>(null);
  const caixa = useCashPage(projetoId);
  const transacoes = caixa.data?.transacoes ?? [];
  const caixaPagina = caixa.data?.pagina ?? 0;
  const caixaTotal = caixa.data?.total ?? 0;
  const focoCaixa = useRef(false);
  useEffect(() => {
    if (caixa.ready && focoCaixa.current) {
      caixaHeading.current?.focus();
      focoCaixa.current = false;
    }
  }, [caixa.ready]);
  const atualizarCaixa = (pagina: number) => {
    focoCaixa.current = true;
    caixa.refresh(pagina);
  };
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<WorkerOption | null>(null);
  const [novaTransacao, setNovaTransacao] = useState({ tipo: "RECEBIMENTO_CLIENTE", valor: "", descricao: "" });
  const salvandoCaixa = isPending("nova-transacao");

  const caixaOcupado = salvandoCaixa || transacoes.some(t => isPending(`transacao-${t.id}`));
  const bloquearCaixa = !caixa.ready || caixaOcupado || transacaoExcluindo !== null || requiresReload;

  const materiaisOcupados = materiais.some(item => isPending(`material-${item.id}`));
  const bloquearMateriais = !listaMateriais.ready || materiaisOcupados || requiresReload;
  const bloquearNavegacaoMateriais = bloquearMateriais || materialEditando !== null || materialExcluindo !== null || Object.keys(precosEditados).length > 0;
  const custoMateriais = listaMateriais.data?.custo ?? 0;
  const materialBloqueado = (id: number) => bloquearMateriais ||
    (materialEditando !== null && materialEditando !== id) ||
    (materialExcluindo !== null && materialExcluindo !== id);

  const totalRecebido = caixa.data?.entradas ?? 0;
  const totalMaoDeObra = caixa.data?.pagamentos ?? 0;
  const lucroAtual = totalRecebido - custoMateriais - totalMaoDeObra;

  const carregarDadosDaObra = useCallback(async (signal: AbortSignal) => {
    if (!/^\d+$/.test(projetoId)) throw new LoadError("Obra não encontrada ou sem acesso.");
    // Valida a obra antes de buscar seus dados. As consultas restantes são independentes.
    const projeto = requireData(await supabase.from("projetos").select("titulo")
      .eq("id", projetoId).abortSignal(signal).maybeSingle<{ titulo: string }>(), "Obra não encontrada ou sem acesso.");
    const auth = await supabase.auth.getUser();
    if (auth.error || !auth.data.user) throw new LoadError("Não foi possível validar sua sessão. Tente novamente ou entre novamente.");
    return { projeto, user: auth.data.user };
  }, [projetoId]);
  const aplicarDadosDaObra = useCallback((data: Awaited<ReturnType<typeof carregarDadosDaObra>>) => {
    setTituloObra(data.projeto.titulo);
    setNomeProfissional(data.user.user_metadata.nome || "");
    setTelefoneContato(data.user.user_metadata.telefone || "");
  }, []);
  const { loading: carregando, ready, error, retry } = useDataLoad(carregarDadosDaObra, aplicarDadosDaObra);

  const limparPrecoEditado = (id: number) => {
    setPrecosEditados(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const atualizarPreco = async (id: number, valorDigitado: string) => {
    if (bloquearMateriais) return;
    const preco = parseMoney(valorDigitado, { allowEmpty: true });
    if (!preco.ok) {
      toast.error(notice(`Preço do material: ${preco.error}`));
      limparPrecoEditado(id);
      return;
    }
    const precoFinal = preco.value;
    const atual = materiais.find(item => item.id === id);

    if (precoFinal !== (atual?.preco_total ?? 0)) {
      await run({
        key: `material-${id}`,
        loading: "Salvando preço...",
        success: "Preço salvo com sucesso!",
        request: () => supabase.from("materiais_projeto")
          .update({ preco_total: precoFinal }).eq("id", id).eq("projeto_id", projetoId)
          .select("id, nome, quantidade, projeto_id, preco_total").single<Material>(),
        onConfirmed: () => atualizarMateriais(materiaisPagina),
        // Também restaura o preço após erro, mas apenas enquanto esta tela estiver ativa.
        onSettled: () => limparPrecoEditado(id),
      });
    } else {
      limparPrecoEditado(id);
    }
  };

  const iniciarEdicaoMaterial = (item: Material) => {
    setMaterialExcluindo(null);
    setMaterialEditando(item.id);
    setNomeEditado(item.nome);
    setQtdEditada(item.quantidade);
  };

  const cancelarEdicaoMaterial = () => {
    if (bloquearMateriais || materialEditando === null) return;
    restaurarEdicao.current = materialEditando;
    setMaterialEditando(null);
  };

  const salvarEdicaoMaterial = async (id: number) => {
    if (bloquearMateriais) return;
    await run({
      key: `material-${id}`,
      loading: "Salvando alterações...",
      success: "Material atualizado!",
      request: () => supabase.from("materiais_projeto")
        .update({ nome: nomeEditado, quantidade: qtdEditada }).eq("id", id).eq("projeto_id", projetoId)
        .select("id, nome, quantidade, projeto_id, preco_total").single<Material>(),
      onConfirmed: () => {
        atualizarMateriais(materiaisPagina);
        setMaterialEditando(prev => prev === id ? null : prev);
      },
    });
  };

  const cancelarExclusaoMaterial = () => {
    setMaterialExcluindo(null);
    exclusaoTrigger.current?.focus();
  };

  const executarExclusaoMaterial = async (id: number) => {
    if (bloquearMateriais || materialExcluindo !== id) return;
    await run({
      key: `material-${id}`,
      loading: "Removendo material...",
      success: "Material excluído!",
      request: () => supabase.from("materiais_projeto").delete()
        .eq("id", id).eq("projeto_id", projetoId).select("id").single<{ id: number }>(),
      onConfirmed: () => {
        atualizarMateriais(materiaisPagina);
        setMaterialExcluindo(null);
      },
    });
  };

  /* ================== LÓGICA FINANCEIRA ================== */
  const handleSelecionarFuncionario = (func: WorkerOption | null) => {
    setFuncionarioSelecionado(func);
    if (func) setNovaTransacao(prev => ({ ...prev, valor: (func.valor_diaria ?? 0).toString().replace(".", ",") }));
  };

  const registrarTransacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bloquearCaixa) return;
    if (!novaTransacao.valor || !novaTransacao.descricao) return toast.error(notice("Preencha o valor e a descrição."));
    
    if (novaTransacao.tipo === "PAGAMENTO_FUNCIONARIO" && !funcionarioSelecionado) {
      return toast.error(notice("Selecione o profissional..."));
    }
    const valor = parseMoney(novaTransacao.valor, { allowZero: false });
    if (!valor.ok) return toast.error(notice(`Lançamento: ${valor.error}`));

  const payload: {
      projeto_id: string;
      tipo: string;
      valor: number;
      descricao: string;
      funcionario_id?: number;
    } = { 
      projeto_id: projetoId as string, 
      tipo: novaTransacao.tipo, 
      valor: valor.value,
      descricao: novaTransacao.descricao 
    };
    if (novaTransacao.tipo === "PAGAMENTO_FUNCIONARIO" && funcionarioSelecionado) {
      payload.funcionario_id = funcionarioSelecionado.id;
    }

    await run({
      key: "nova-transacao",
      loading: "Registrando no caixa...",
      success: "Lançamento registrado!",
      request: () => supabase.from("financeiro_obra").insert([payload])
        .select("id, tipo, valor, data, descricao, funcionario_id").single<CashTransaction>(),
      onConfirmed: () => {
        atualizarCaixa(0);
        setNovaTransacao({ tipo: "RECEBIMENTO_CLIENTE", valor: "", descricao: "" });
        setFuncionarioSelecionado(null);
      },
    });
  };

  const cancelarExclusaoTransacao = () => {
    setTransacaoExcluindo(null);
    transacaoTrigger.current?.focus();
  };

  const excluirTransacao = async (id: number) => {
    if (transacaoExcluindo !== id || requiresReload || !caixa.ready || caixaOcupado) return;
    await run({
      key: `transacao-${id}`,
      loading: "Removendo lançamento...",
      success: "Lançamento removido.",
      request: () => supabase.from("financeiro_obra").delete()
        .eq("id", id).eq("projeto_id", projetoId).select("id").single<{ id: number }>(),
      onConfirmed: () => {
        atualizarCaixa(caixaPagina);
        setTransacaoExcluindo(null);
        transacaoTrigger.current = null;
        caixaHeading.current?.focus();
      },
    });
  };
  if (!ready) return <section lang={locale}>
    <h1 className="text-2xl font-extrabold text-zinc-900">{p("Detalhes da Obra")}</h1>
    <Link href="/projetos" className="inline-block p-3 font-bold text-orange-800 underline">{p("Voltar para projetos")}</Link>
    <LoadFeedback error={error} retry={retry} />
  </section>;

  return (
    <MutationGuard blocked={requiresReload}>
    <div lang={locale} className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER PRINCIPAL */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link aria-label={p("Voltar para projetos")} href="/projetos" className="p-2 bg-zinc-100 text-zinc-700 rounded-xl hover:bg-zinc-200 hover:text-zinc-900 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight">{tituloObra}</h1>
            <p className="text-sm md:text-base text-zinc-600 mt-1">{p("Gestão de materiais, tarefas e caixa.")}</p>
          </div>
        </div>

        {materiaisTotal > 0 && <MaterialQuote key={listaMateriais.data?.revision}
          projectId={projetoId} worker={nomeProfissional} project={tituloObra} phone={telefoneContato}
          disabled={bloquearNavegacaoMateriais} />}

      </div>

      {/* MINI-DASHBOARD FINANCEIRO */}
      {!carregando && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <p className="text-xs font-bold text-zinc-600 uppercase flex items-center gap-1"><TrendingUp size={14} className="text-emerald-600"/> {p("Entradas")}</p>
            <p className="text-lg md:text-2xl font-black text-zinc-900 mt-1">{caixa.ready ? formatBRL(locale, totalRecebido) : p("Indisponível")}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <p className="text-xs font-bold text-zinc-600 uppercase flex items-center gap-1"><ShoppingCart size={14} className="text-orange-600"/> {p("Materiais")}</p>
            <p className="text-lg md:text-2xl font-black text-zinc-900 mt-1">{listaMateriais.ready ? formatBRL(locale, custoMateriais) : p("Indisponível")}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <p className="text-xs font-bold text-zinc-600 uppercase flex items-center gap-1"><Users size={14} className="text-blue-600"/> {p("Equipe")}</p>
            <p className="text-lg md:text-2xl font-black text-zinc-900 mt-1">{caixa.ready ? formatBRL(locale, totalMaoDeObra) : p("Indisponível")}</p>
          </div>
          <div className={`p-4 rounded-xl border shadow-sm ${!caixa.ready || !listaMateriais.ready ? 'bg-zinc-100 border-zinc-300 text-zinc-900' : lucroAtual >= 0 ? 'bg-emerald-900 border-emerald-950 text-white' : 'bg-red-900 border-red-950 text-white'}`}>
            <p className="text-xs font-bold opacity-90 uppercase flex items-center gap-1"><Wallet size={14}/> {p("Lucro Atual")}</p>
            <p className="text-lg md:text-2xl font-black mt-1">{caixa.ready && listaMateriais.ready ? formatBRL(locale, lucroAtual) : p("Indisponível")}</p>
          </div>
        </div>
      )}

      {/* MENU DE ABAS (Mobile) */}
      <div className="lg:hidden flex bg-zinc-200 p-1 rounded-xl shadow-inner gap-1">
        <button onClick={() => setAbaAtiva("materiais")} className={`flex-1 py-3 flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg font-bold text-xs sm:text-sm transition-all ${abaAtiva === "materiais" ? "bg-white text-orange-600 shadow-sm" : "text-zinc-600"}`}>
          <ShoppingCart size={18} /> {p("Orçamento")}
        </button>
        <button onClick={() => setAbaAtiva("caixa")} className={`flex-1 py-3 flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg font-bold text-xs sm:text-sm transition-all ${abaAtiva === "caixa" ? "bg-white text-emerald-600 shadow-sm" : "text-zinc-600"}`}>
          <Wallet size={18} /> {p("Caixa")}
        </button>
        <button onClick={() => setAbaAtiva("tarefas")} className={`flex-1 py-3 flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg font-bold text-xs sm:text-sm transition-all ${abaAtiva === "tarefas" ? "bg-white text-blue-600 shadow-sm" : "text-zinc-600"}`}>
          <CheckSquare size={18} /> {p("Tarefas")}
        </button>
      </div>

      {carregando ? (
        <div className="p-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      ) : (
        /* GRID RESPONSIVO: Abas no Mobile vs 3 Colunas no Desktop */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* COLUNA 1: MATERIAIS */}
          <div className={`${abaAtiva === "materiais" ? "block" : "hidden"} lg:block space-y-6`}>
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col max-h-175">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center">
                <h2 ref={materiaisHeading} tabIndex={-1} className="font-bold text-zinc-900">{p("Lista de Materiais")}</h2>
              </div>
              
              <div className="overflow-y-auto flex-1">
                {!listaMateriais.ready ? <LoadFeedback error={listaMateriais.error} retry={listaMateriais.retry} /> : materiais.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center">
                    <ShoppingCart size={40} className="text-zinc-400 mb-3" />
                    <p className="text-zinc-600 font-medium">{p("Nenhum material adicionado.")}</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-zinc-100">
                    {materiais.map((item) => (
                      <li key={item.id} className="p-4 flex flex-col gap-3 hover:bg-zinc-50 transition-colors">
                        {materialEditando === item.id ? (
                          <EdicaoMaterial
                            titulo={p("Editar {name}", { name: item.nome })}
                            nome={nomeEditado} quantidade={qtdEditada}
                            disabled={materialBloqueado(item.id)}
                            onNome={setNomeEditado} onQuantidade={setQtdEditada}
                            onCancel={cancelarEdicaoMaterial}
                            onSave={() => { void salvarEdicaoMaterial(item.id); }}
                          />
                        ) : (
                          <>
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-bold text-zinc-900 text-lg">{item.nome}</p>
                                <span className="inline-block bg-orange-100 text-orange-800 py-1 px-3 rounded-full font-bold text-xs mt-1">{item.quantidade}</span>
                              </div>
                              <div className="flex gap-1">
                                <button type="button" ref={node => { botoesEditar.current[item.id] = node; }} aria-label={p("Editar {name}", { name: item.nome })} disabled={materialBloqueado(item.id)} onClick={() => iniciarEdicaoMaterial(item)} className="min-h-11 min-w-11 p-2 text-zinc-700 hover:text-blue-800 rounded-lg hover:bg-blue-50 transition-colors focus-visible:outline-2 focus-visible:outline-blue-800"><Edit2 size={18} /></button>
                                <button type="button" aria-label={p("Excluir {name}", { name: item.nome })} aria-expanded={materialExcluindo === item.id} disabled={materialBloqueado(item.id)} onClick={event => {
                                  exclusaoTrigger.current = event.currentTarget;
                                  setMaterialEditando(null);
                                  setMaterialExcluindo(item.id);
                                }} className="min-h-11 min-w-11 p-2 text-zinc-700 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors focus-visible:outline-2 focus-visible:outline-red-800"><Trash2 size={18} /></button>
                              </div>
                            </div>
                            <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-xl border border-zinc-200 mt-1">
                              <label htmlFor={`preco-${projetoId}-${item.id}`} className="text-xs font-bold text-zinc-700 uppercase tracking-wide">{p("Custo Registrado")}</label>
                              <div className="flex items-center text-emerald-800 font-bold bg-white px-3 py-1.5 rounded-lg border border-zinc-300 shadow-sm focus-within:ring-2 focus-within:ring-emerald-600 transition-all">
                                <span className="text-zinc-500 mr-1 text-sm">R$</span>
                                <input id={`preco-${projetoId}-${item.id}`} type="text" inputMode="decimal" disabled={materialBloqueado(item.id)} aria-label={`${p("Custo Registrado")}: ${item.nome}`} value={precosEditados[item.id] ?? (item.preco_total ? item.preco_total.toString().replace(".", ",") : "")} onChange={(e) => setPrecosEditados(prev => ({ ...prev, [item.id]: e.target.value }))} placeholder={p("0,00")} onBlur={(e) => atualizarPreco(item.id, e.target.value)} className="min-h-11 w-24 text-right outline-none bg-transparent placeholder-zinc-600" />
                              </div>
                            </div>
                          </>
                        )}
                        {materialExcluindo === item.id && <DeleteConfirmation
                          key={item.id}
                          title={p("Excluir {name}?", { name: item.nome })}
                          description={p("O material e seu custo serão removidos permanentemente deste orçamento.")}
                          pending={isPending(`material-${item.id}`)}
                          onCancel={cancelarExclusaoMaterial}
                          onConfirm={() => { void executarExclusaoMaterial(item.id); }}
                        />}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              <p role="status" className="px-4 text-sm text-zinc-700">
                {listaMateriais.ready && p("{from}–{to} de {total} materiais", {
                  from: materiaisTotal ? materiaisPagina * MATERIALS_PAGE_SIZE + 1 : 0,
                  to: materiaisPagina * MATERIALS_PAGE_SIZE + materiais.length, total: materiaisTotal,
                })}
              </p>
              <nav aria-label={p("Paginação dos materiais")} className="flex justify-between gap-2 p-4">
                <button type="button" disabled={bloquearNavegacaoMateriais || materiaisPagina === 0}
                  onClick={() => atualizarMateriais(materiaisPagina - 1)}
                  className="min-h-11 rounded-lg border border-zinc-400 px-3 py-2 font-bold text-zinc-900 disabled:opacity-50">{p("Anterior")}</button>
                <button type="button" disabled={bloquearNavegacaoMateriais || (materiaisPagina + 1) * MATERIALS_PAGE_SIZE >= materiaisTotal}
                  onClick={() => atualizarMateriais(materiaisPagina + 1)}
                  className="min-h-11 rounded-lg border border-zinc-400 px-3 py-2 font-bold text-zinc-900 disabled:opacity-50">{p("Próxima")}</button>
              </nav>
              <div className="p-4 bg-zinc-50 border-t border-zinc-200">
                <Link href="/calcular" className="flex items-center justify-center gap-2 w-full bg-orange-100 text-orange-800 font-bold p-4 rounded-xl hover:bg-orange-200 transition-colors">
                  <Calculator size={20} /> {p("Nova Medição")}
                </Link>
              </div>
            </div>


          </div>

          {/* COLUNA 2: FINANCEIRO E CAIXA */}
          <div className={`${abaAtiva === "caixa" ? "block" : "hidden"} lg:block space-y-6`}>
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col max-h-175">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center gap-2">
                <Wallet size={20} className="text-emerald-700" />
                <h2 ref={caixaHeading} tabIndex={-1} className="font-bold text-zinc-900">{p("Caixa da Obra")}</h2>
              </div>
              
              <div className="p-4 border-b border-zinc-200 bg-white">
                <form onSubmit={registrarTransacao} className="flex flex-col gap-3">
                  <label htmlFor={`tipo-caixa-${projetoId}`} className="text-sm font-bold text-zinc-900">{p("Tipo de lançamento")}</label>
                  <select id={`tipo-caixa-${projetoId}`} className="min-h-11 p-3 border border-zinc-300 rounded-xl text-sm font-bold outline-none bg-zinc-50 text-zinc-900 focus:ring-2 focus:ring-emerald-700" disabled={bloquearCaixa} aria-label={p("Tipo de lançamento")} value={novaTransacao.tipo} onChange={(e) => { setFuncionarioSelecionado(null); setNovaTransacao({ ...novaTransacao, tipo: e.target.value }); }}>
                    <option value="RECEBIMENTO_CLIENTE">{p("Entrada: Dinheiro do Cliente")}</option>
                    <option value="PAGAMENTO_FUNCIONARIO">{p("Saída: Pagamento da Equipe")}</option>
                  </select>

                  {novaTransacao.tipo === "PAGAMENTO_FUNCIONARIO" && (
                    <WorkerPicker id="profissional-caixa" selected={funcionarioSelecionado}
                      onSelect={handleSelecionarFuncionario} disabled={bloquearCaixa} />
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <label htmlFor={`descricao-caixa-${projetoId}`} className="block text-sm font-bold text-zinc-900">{p("Descrição")}</label>
                      <input
                        id={`descricao-caixa-${projetoId}`} type="text"
                        className="min-h-11 w-full p-3 border border-zinc-300 rounded-xl text-sm text-zinc-900 placeholder-zinc-600 outline-none focus:ring-2 focus:ring-emerald-700 transition-all"
                        placeholder={novaTransacao.tipo === "RECEBIMENTO_CLIENTE" ? p("Ex: Sinal / 1ª Parcela") : p("Ex: Adiantamento / 3 dias")}
                        disabled={bloquearCaixa} aria-label={p("Descrição")} value={novaTransacao.descricao}
                        onChange={(e) => setNovaTransacao({ ...novaTransacao, descricao: e.target.value })}
                        required
                      />
                    </div>
                    <div className="min-w-0 sm:w-44 space-y-2">
                      <label htmlFor={`valor-caixa-${projetoId}`} className="block text-sm font-bold text-zinc-900">{p("Valor em reais")}</label>
                      <div className="flex min-h-11 items-center bg-white border border-zinc-300 rounded-xl px-3 focus-within:ring-2 focus-within:ring-emerald-700 transition-all">
                        <span aria-hidden="true" className="text-zinc-700 text-sm font-bold">R$</span>
                        <input
                          id={`valor-caixa-${projetoId}`} type="text"
                          inputMode="decimal"
                          className="min-w-0 w-full py-3 pl-2 outline-none text-right text-sm font-bold text-zinc-900 placeholder-zinc-600 bg-transparent"
                          disabled={bloquearCaixa} aria-label={p("Valor em reais")} value={novaTransacao.valor}
                          onChange={(e) => setNovaTransacao({ ...novaTransacao, valor: e.target.value })}
                          placeholder={p("0,00")}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <button type="submit" disabled={bloquearCaixa} className="min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 bg-emerald-700 text-white font-bold p-3 rounded-xl hover:bg-emerald-800 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50 mt-1 shadow-sm">
                    <Plus size={16}/> {p("Lançar no Caixa")}
                  </button>
                </form>
              </div>

              <div className="overflow-y-auto flex-1 p-3">
                {!caixa.ready ? <LoadFeedback error={caixa.error} retry={caixa.retry} /> : transacoes.length === 0 ? <p className="text-center text-zinc-600 font-medium py-6 text-sm">{p("Nenhuma movimentação.")}</p> : (
                  <ul className="space-y-2">
                    {transacoes.map(t => (
                      <li key={t.id} className="p-3 border border-zinc-200 rounded-xl bg-white shadow-sm hover:border-zinc-300 transition-colors">
                        <div className="flex justify-between items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              {t.tipo === "RECEBIMENTO_CLIENTE" ? <TrendingUp size={16} className="text-emerald-700"/> : <TrendingDown size={16} className="text-red-700"/>}
                              <span className="font-bold text-zinc-900 text-sm">{t.tipo === "RECEBIMENTO_CLIENTE" ? p("Recebimento") : t.funcionarios?.nome || p("Equipe")}</span>
                            </div>
                            <p className="text-xs font-medium text-zinc-600 mt-1 truncate max-w-37.5">{t.descricao ?? p("Sem descrição")}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`font-black text-sm ${t.tipo === "RECEBIMENTO_CLIENTE" ? "text-emerald-700" : "text-red-700"}`}>
                              {t.tipo === "RECEBIMENTO_CLIENTE" ? "+" : "-"} {formatBRL(locale, t.valor)}
                            </span>
                            <button type="button" aria-label={p("Excluir {name}", { name: t.descricao ?? p("Sem descrição") })}
                              aria-expanded={transacaoExcluindo === t.id}
                              disabled={caixaOcupado || (transacaoExcluindo !== null && transacaoExcluindo !== t.id)}
                              onClick={event => {
                                transacaoTrigger.current = event.currentTarget;
                                setTransacaoExcluindo(t.id);
                              }}
                              className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-zinc-700 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-red-800"><Trash2 size={16}/></button>
                          </div>
                        </div>
                        {transacaoExcluindo === t.id && <div className="mt-3">
                          <DeleteConfirmation
                            title={p("Excluir {name}?", { name: t.descricao ?? p("Sem descrição") })}
                            description={p(t.tipo === "RECEBIMENTO_CLIENTE"
                              ? "Este recebimento de {value} será removido permanentemente. O saldo calculado da obra diminuirá nesse valor."
                              : "Este pagamento de {value} será removido permanentemente. O saldo calculado da obra aumentará nesse valor. Isso não estorna o pagamento ao profissional.",
                            { value: formatBRL(locale, t.valor) })}
                            pending={isPending(`transacao-${t.id}`)}
                            onCancel={cancelarExclusaoTransacao}
                            onConfirm={() => { void excluirTransacao(t.id); }}
                          />
                        </div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p role="status" className="px-4 text-sm text-zinc-700">
                {caixa.ready && p("{from}–{to} de {total} lançamentos", {
                  from: caixaTotal ? caixaPagina * CASH_PAGE_SIZE + 1 : 0,
                  to: caixaPagina * CASH_PAGE_SIZE + transacoes.length, total: caixaTotal,
                })}
              </p>
              <nav aria-label={p("Paginação do caixa")} className="flex justify-between gap-2 p-4">
                <button type="button" disabled={bloquearCaixa || caixaPagina === 0}
                  onClick={() => atualizarCaixa(caixaPagina - 1)}
                  className="min-h-11 rounded-lg border border-zinc-400 px-3 py-2 font-bold text-zinc-900 disabled:opacity-50">{p("Anterior")}</button>
                <button type="button" disabled={bloquearCaixa || (caixaPagina + 1) * CASH_PAGE_SIZE >= caixaTotal}
                  onClick={() => atualizarCaixa(caixaPagina + 1)}
                  className="min-h-11 rounded-lg border border-zinc-400 px-3 py-2 font-bold text-zinc-900 disabled:opacity-50">{p("Próxima")}</button>
              </nav>
            </div>
          </div>

          {/* COLUNA 3: TAREFAS */}
          <div className={`${abaAtiva === "tarefas" ? "block" : "hidden"} lg:block space-y-6`}>
            <ProjectTasks key={projetoId} projetoId={projetoId} />
          </div>

        </div>
      )}
    </div>
    </MutationGuard>
  );
}

type EdicaoMaterialProps = {
  titulo: string; nome: string; quantidade: string; disabled: boolean;
  onNome: (value: string) => void; onQuantidade: (value: string) => void;
  onCancel: () => void; onSave: () => void;
};

function EdicaoMaterial({ titulo, nome, quantidade, disabled, onNome, onQuantidade, onCancel, onSave }: EdicaoMaterialProps) {
  const { p } = usePrivateLocale();
  const id = useId();
  const nomeInput = useRef<HTMLInputElement>(null);
  useEffect(() => { nomeInput.current?.focus(); }, []);

  return <form aria-labelledby={`${id}-titulo`} aria-busy={disabled}
    className="space-y-3 rounded-xl border border-orange-300 bg-orange-50 p-3"
    onSubmit={event => { event.preventDefault(); if (!disabled) onSave(); }}
    onKeyDown={event => {
      if (event.key === "Escape" && !disabled) {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    }}>
    <p id={`${id}-titulo`} className="font-bold text-zinc-900">{titulo}</p>
    <label htmlFor={`${id}-nome`} className="block text-sm font-bold text-zinc-900">{p("Nome")}</label>
    <input ref={nomeInput} id={`${id}-nome`} aria-label={p("Nome")} value={nome}
      disabled={disabled} onChange={event => onNome(event.target.value)}
      className="min-h-11 w-full rounded-lg border border-zinc-500 bg-white p-3 text-zinc-900 focus-visible:outline-2 focus-visible:outline-orange-800" />
    <label htmlFor={`${id}-quantidade`} className="block text-sm font-bold text-zinc-900">{p("Quantidade")}</label>
    <input id={`${id}-quantidade`} aria-label={p("Quantidade")} value={quantidade}
      disabled={disabled} onChange={event => onQuantidade(event.target.value)}
      className="min-h-11 w-full rounded-lg border border-zinc-500 bg-white p-3 text-zinc-900 focus-visible:outline-2 focus-visible:outline-orange-800" />
    <div className="flex flex-wrap gap-2">
      <button type="button" aria-label={p("Cancelar edição")} disabled={disabled} onClick={onCancel}
        className="flex min-h-11 items-center gap-2 rounded-lg bg-zinc-200 px-3 py-2 font-bold text-zinc-900 focus-visible:outline-2 focus-visible:outline-zinc-900">
        <X size={18} aria-hidden="true" />{p("Cancelar edição")}
      </button>
      <button type="submit" aria-label={p("Salvar material")} disabled={disabled}
        className="flex min-h-11 items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-900">
        <Save size={18} aria-hidden="true" />{p("Salvar material")}
      </button>
    </div>
  </form>;
}
