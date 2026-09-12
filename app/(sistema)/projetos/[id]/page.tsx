"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase"; 
import { useDataLoad } from "@/app/hooks/useDataLoad";
import { LoadFeedback } from "@/app/components/LoadFeedback";
import { loadAllRows, requireData, LoadError } from "@/lib/load-data";
import Link from "next/link";
import { useConfirmedMutation } from "@/app/hooks/useConfirmedMutation";
import { parseMoney } from "@/lib/money";
import toast from "react-hot-toast";
import { 
  ArrowLeft, ShoppingCart, CheckSquare, MessageCircle, 
  Edit2, Trash2, Plus, Calculator, X, Save, Check,
  TrendingUp, TrendingDown, Wallet, Users
} from "lucide-react";

interface Tarefa {
  id: number;
  nome: string;
  concluida: boolean;
  projeto_id: number;
}

interface Material {
  id: number;
  nome: string;
  quantidade: string;
  projeto_id: number;
  preco_total: number; 
}

interface Funcionario { 
  id: number; 
  nome: string; 
  valor_diaria: number; 
}
interface Transacao { 
  id: number; 
  tipo: "RECEBIMENTO_CLIENTE" | "PAGAMENTO_FUNCIONARIO"; 
  valor: number; 
  data: string; 
  descricao: string; 
  funcionario_id?: number; 
  funcionarios?: { nome: string }; // Join do banco
}

export default function ProjetoPage() {
  const { id } = useParams<{ id: string }>();
  return <DetalhesDoProjeto key={id} projetoId={id} />;
}

function DetalhesDoProjeto({ projetoId }: { projetoId: string }) {
  const { run, isPending } = useConfirmedMutation();
  const [precosEditados, setPrecosEditados] = useState<Record<number, string>>({});
  const [tituloObra, setTituloObra] = useState("Carregando...");
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [novaTarefa, setNovaTarefa] = useState("");
  
  // Agora temos 3 abas
  const [abaAtiva, setAbaAtiva] = useState<"materiais" | "tarefas" | "caixa">("materiais");
  
  const [materialEditando, setMaterialEditando] = useState<number | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [qtdEditada, setQtdEditada] = useState("");
  
  const [nomeProfissional, setNomeProfissional] = useState("Profissional");
  const [telefoneContato, setTelefoneContato] = useState("");

  // Novos estados financeiros
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [novaTransacao, setNovaTransacao] = useState({ tipo: "RECEBIMENTO_CLIENTE", valor: "", descricao: "", funcionario_id: "" });
  const salvandoCaixa = isPending("nova-transacao");
  const salvandoTarefa = isPending("nova-tarefa");

  // Cálculos Automáticos
  const custoMateriais = materiais.reduce((acumulador, item) => {
    const valor = typeof item.preco_total === 'string' ? parseFloat(item.preco_total) : item.preco_total;
    return acumulador + (valor || 0);
  }, 0);

  const totalRecebido = transacoes.filter(t => t.tipo === "RECEBIMENTO_CLIENTE").reduce((acc, item) => acc + item.valor, 0);
  const totalMaoDeObra = transacoes.filter(t => t.tipo === "PAGAMENTO_FUNCIONARIO").reduce((acc, item) => acc + item.valor, 0);
  const lucroAtual = totalRecebido - custoMateriais - totalMaoDeObra;

  const carregarDadosDaObra = useCallback(async (signal: AbortSignal) => {
    if (!/^\d+$/.test(projetoId)) throw new LoadError("Obra não encontrada ou sem acesso.");
    // Valida a obra antes de buscar seus dados. As consultas restantes são independentes.
    const projeto = requireData(await supabase.from("projetos").select("titulo")
      .eq("id", projetoId).abortSignal(signal).maybeSingle<{ titulo: string }>(), "Obra não encontrada ou sem acesso.");
    const [tarefas, materiais, transacoes, funcionarios, auth] = await Promise.all([
      loadAllRows<Tarefa>((from, to) => supabase.from("tarefas")
        .select("id, nome, concluida, projeto_id", { count: "exact" }).eq("projeto_id", projetoId)
        .order("criado_em").order("id").range(from, to).abortSignal(signal), signal),
      loadAllRows<Material>((from, to) => supabase.from("materiais_projeto")
        .select("id, nome, quantidade, projeto_id, preco_total", { count: "exact" }).eq("projeto_id", projetoId)
        .order("id", { ascending: false }).range(from, to).abortSignal(signal), signal),
      loadAllRows<Transacao>((from, to) => supabase.from("financeiro_obra")
        .select("id, tipo, valor, data, descricao, funcionario_id, funcionarios(nome)", { count: "exact" }).eq("projeto_id", projetoId)
        .order("id", { ascending: false }).range(from, to).abortSignal(signal)
        .overrideTypes<Transacao[], { merge: false }>(), signal),
      loadAllRows<Funcionario>((from, to) => supabase.from("funcionarios")
        .select("id, nome, valor_diaria", { count: "exact" }).order("nome").order("id")
        .range(from, to).abortSignal(signal), signal),
      supabase.auth.getUser(),
    ]);
    if (auth.error || !auth.data.user) throw new LoadError("Não foi possível validar sua sessão. Tente novamente ou entre novamente.");
    return { projeto, tarefas, materiais, transacoes, funcionarios, user: auth.data.user };
  }, [projetoId]);
  const aplicarDadosDaObra = useCallback((data: Awaited<ReturnType<typeof carregarDadosDaObra>>) => {
    setTituloObra(data.projeto.titulo);
    setTarefas(data.tarefas);
    setMateriais(data.materiais);
    setTransacoes(data.transacoes);
    setFuncionarios(data.funcionarios);
    setNomeProfissional(data.user.user_metadata.nome || "Profissional");
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
    if (isPending(`material-${id}`)) return;
    const preco = parseMoney(valorDigitado, { allowEmpty: true });
    if (!preco.ok) {
      toast.error(`Preço do material: ${preco.error}`);
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
        onConfirmed: (material) => setMateriais(prev => prev.map(item => item.id === id ? material : item)),
      });
    }
    // Em caso de falha, o campo volta ao último preço confirmado, assim como o total.
    limparPrecoEditado(id);
  };

  const iniciarEdicaoMaterial = (item: Material) => {
    setMaterialEditando(item.id);
    setNomeEditado(item.nome);
    setQtdEditada(item.quantidade);
  };

  const salvarEdicaoMaterial = async (id: number) => {
    await run({
      key: `material-${id}`,
      loading: "Salvando alterações...",
      success: "Material atualizado!",
      request: () => supabase.from("materiais_projeto")
        .update({ nome: nomeEditado, quantidade: qtdEditada }).eq("id", id).eq("projeto_id", projetoId)
        .select("id, nome, quantidade, projeto_id, preco_total").single<Material>(),
      onConfirmed: (material) => {
        setMateriais(prev => prev.map(item => item.id === id ? material : item));
        setMaterialEditando(prev => prev === id ? null : prev);
      },
    });
  };

  const confirmarExclusaoMaterial = (id: number) => {
    toast.dismiss(); 
    
    toast(
      (t) => (
        <div className="flex flex-col gap-2">
          <p className="font-bold text-zinc-900 text-lg">Excluir material?</p>
          <p className="text-sm text-zinc-600 mb-2">Ele será removido permanentemente deste orçamento.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => toast.dismiss(t.id)} className="px-4 py-2 bg-zinc-200 text-zinc-800 rounded-lg font-bold hover:bg-zinc-300 transition-colors">
              Cancelar
            </button>
            <button onClick={() => { toast.dismiss(t.id); executarExclusaoMaterial(id); }} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-sm">
              Sim, Excluir
            </button>
          </div>
        </div>
      ),
      // 2. ID dinâmico: garante que o React saiba exatamente qual item está sendo apagado
      { duration: Infinity, id: `exclusao-${id}` } 
    );
  };

  const executarExclusaoMaterial = async (id: number) => {
    await run({
      key: `material-${id}`,
      loading: "Removendo material...",
      success: "Material excluído!",
      request: () => supabase.from("materiais_projeto").delete()
        .eq("id", id).eq("projeto_id", projetoId).select("id").single<{ id: number }>(),
      onConfirmed: (material) => setMateriais(prev => prev.filter(item => item.id !== material.id)),
    });
  };

  const criarTarefa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTarefa.trim()) return;
    await run({
      key: "nova-tarefa",
      loading: "Adicionando tarefa...",
      success: "Tarefa adicionada!",
      request: () => supabase.from("tarefas").insert([{ nome: novaTarefa, projeto_id: projetoId }])
        .select("id, nome, concluida, projeto_id").single<Tarefa>(),
      onConfirmed: (tarefa) => {
        setTarefas(prev => [...prev, tarefa]);
        setNovaTarefa("");
      },
    });
  };

  const alternarConclusao = async (id: number, statusAtual: boolean) => {
    await run({
      key: `tarefa-${id}`,
      loading: "Atualizando tarefa...",
      success: "Tarefa atualizada!",
      request: () => supabase.from("tarefas").update({ concluida: !statusAtual })
        .eq("id", id).eq("projeto_id", projetoId)
        .select("id, nome, concluida, projeto_id").single<Tarefa>(),
      onConfirmed: (tarefa) => setTarefas(prev => prev.map(item => item.id === id ? tarefa : item)),
    });
  };

  const solicitarOrcamentoWhatsApp = () => {
    const e = { worker: '👷‍♂️', clipboard: '📋', bullet: '▪️', bulb: '💡', phone: '📞' };
    let textoMensagem = `Olá! Aqui é o ${nomeProfissional}. ${e.worker}\nSegue a relação de materiais atualizada para a obra: *${tituloObra}*\n\n*${e.clipboard} LISTA DE MATERIAIS:*\n`;
    materiais.forEach(item => { textoMensagem += `${e.bullet} *${item.nome}:* ${item.quantidade}\n`; });
    textoMensagem += `\n*${e.bulb} Obra Certa:* Planejamento inteligente, transparência e sem desperdício.\nQualquer dúvida sobre as medidas, estou à disposição!\n`;
    if (telefoneContato) textoMensagem += `${e.phone} Contato: ${telefoneContato}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(textoMensagem)}`, '_blank');
  };

  /* ================== LÓGICA FINANCEIRA ================== */
  const handleSelecionarFuncionario = (idStr: string) => {
    const func = funcionarios.find(f => f.id.toString() === idStr);
    if (func) {
      setNovaTransacao({ ...novaTransacao, funcionario_id: idStr, valor: (func.valor_diaria ?? 0).toString().replace(".", ",") });
    } else {
      setNovaTransacao({ ...novaTransacao, funcionario_id: idStr });
    }
  };

  const registrarTransacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTransacao.valor || !novaTransacao.descricao) return toast.error("Preencha o valor e a descrição.");
    
    const valor = parseMoney(novaTransacao.valor, { allowZero: false });
    if (!valor.ok) return toast.error(`Lançamento: ${valor.error}`);

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
    if (novaTransacao.tipo === "PAGAMENTO_FUNCIONARIO" && novaTransacao.funcionario_id) {
      payload.funcionario_id = parseInt(novaTransacao.funcionario_id);
    }

    await run({
      key: "nova-transacao",
      loading: "Registrando no caixa...",
      success: "Lançamento registrado!",
      request: () => supabase.from("financeiro_obra").insert([payload])
        .select("id, tipo, valor, data, descricao, funcionario_id").single<Transacao>(),
      onConfirmed: (transacao) => {
        const funcionario = funcionarios.find(f => f.id === transacao.funcionario_id);
        setTransacoes(prev => [{ ...transacao, funcionarios: funcionario ? { nome: funcionario.nome } : undefined }, ...prev]);
        setNovaTransacao({ tipo: "RECEBIMENTO_CLIENTE", valor: "", descricao: "", funcionario_id: "" });
      },
    });
  };

  const excluirTransacao = async (id: number) => {
    await run({
      key: `transacao-${id}`,
      loading: "Removendo lançamento...",
      success: "Lançamento removido.",
      request: () => supabase.from("financeiro_obra").delete()
        .eq("id", id).eq("projeto_id", projetoId).select("id").single<{ id: number }>(),
      onConfirmed: (transacao) => setTransacoes(prev => prev.filter(t => t.id !== transacao.id)),
    });
  };
  if (!ready) return <section>
    <h1 className="text-2xl font-extrabold text-zinc-900">Detalhes da Obra</h1>
    <Link href="/projetos" className="inline-block p-3 font-bold text-orange-800 underline">Voltar para projetos</Link>
    <LoadFeedback error={error} retry={retry} />
  </section>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER PRINCIPAL */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/projetos" className="p-2 bg-zinc-100 text-zinc-700 rounded-xl hover:bg-zinc-200 hover:text-zinc-900 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight">{tituloObra}</h1>
            <p className="text-sm md:text-base text-zinc-600 mt-1">Gestão de materiais, tarefas e caixa.</p>
          </div>
        </div>

        {/* Botão do WhatsApp */}
        {materiais.length > 0 && !carregando && (
          <button 
            onClick={solicitarOrcamentoWhatsApp}
            className="hidden lg:flex items-center justify-center gap-2 bg-[#25D366] text-white px-5 py-3 rounded-xl hover:bg-[#128C7E] transition-colors shadow-sm font-bold"
          >
            <MessageCircle size={20} />
            Enviar Relatório (WhatsApp)
          </button>
        )}
      </div>

      {/* MINI-DASHBOARD FINANCEIRO */}
      {!carregando && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <p className="text-xs font-bold text-zinc-600 uppercase flex items-center gap-1"><TrendingUp size={14} className="text-emerald-600"/> Entradas</p>
            <p className="text-lg md:text-2xl font-black text-zinc-900 mt-1">R$ {totalRecebido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <p className="text-xs font-bold text-zinc-600 uppercase flex items-center gap-1"><ShoppingCart size={14} className="text-orange-600"/> Materiais</p>
            <p className="text-lg md:text-2xl font-black text-zinc-900 mt-1">R$ {custoMateriais.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <p className="text-xs font-bold text-zinc-600 uppercase flex items-center gap-1"><Users size={14} className="text-blue-600"/> Equipe</p>
            <p className="text-lg md:text-2xl font-black text-zinc-900 mt-1">R$ {totalMaoDeObra.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
          </div>
          <div className={`p-4 rounded-xl border shadow-sm ${lucroAtual >= 0 ? 'bg-emerald-900 border-emerald-950 text-white' : 'bg-red-900 border-red-950 text-white'}`}>
            <p className="text-xs font-bold opacity-90 uppercase flex items-center gap-1"><Wallet size={14}/> Lucro Atual</p>
            <p className="text-lg md:text-2xl font-black mt-1">R$ {lucroAtual.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
          </div>
        </div>
      )}

      {/* MENU DE ABAS (Mobile) */}
      <div className="lg:hidden flex bg-zinc-200 p-1 rounded-xl shadow-inner gap-1">
        <button onClick={() => setAbaAtiva("materiais")} className={`flex-1 py-3 flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg font-bold text-xs sm:text-sm transition-all ${abaAtiva === "materiais" ? "bg-white text-orange-600 shadow-sm" : "text-zinc-600"}`}>
          <ShoppingCart size={18} /> Orçamento
        </button>
        <button onClick={() => setAbaAtiva("caixa")} className={`flex-1 py-3 flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg font-bold text-xs sm:text-sm transition-all ${abaAtiva === "caixa" ? "bg-white text-emerald-600 shadow-sm" : "text-zinc-600"}`}>
          <Wallet size={18} /> Caixa
        </button>
        <button onClick={() => setAbaAtiva("tarefas")} className={`flex-1 py-3 flex flex-col sm:flex-row items-center justify-center gap-1 rounded-lg font-bold text-xs sm:text-sm transition-all ${abaAtiva === "tarefas" ? "bg-white text-blue-600 shadow-sm" : "text-zinc-600"}`}>
          <CheckSquare size={18} /> Tarefas
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
                <h2 className="font-bold text-zinc-900">Lista de Materiais</h2>
              </div>
              
              <div className="overflow-y-auto flex-1">
                {materiais.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center">
                    <ShoppingCart size={40} className="text-zinc-400 mb-3" />
                    <p className="text-zinc-600 font-medium">Nenhum material adicionado.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-zinc-100">
                    {materiais.map((item) => (
                      <li key={item.id} className="p-4 flex flex-col gap-3 hover:bg-zinc-50 transition-colors">
                        {materialEditando === item.id ? (
                          <div className="flex flex-col sm:flex-row gap-3 bg-orange-50 p-3 rounded-xl border border-orange-300 animate-in fade-in">
                            <input className="flex-1 p-3 border border-orange-300 rounded-lg text-zinc-900 outline-none focus:ring-2 focus:ring-orange-600 bg-white" disabled={isPending(`material-${item.id}`)} value={nomeEditado} onChange={(e) => setNomeEditado(e.target.value)} placeholder="Nome" />
                            <input className="w-full sm:w-32 p-3 border border-orange-300 rounded-lg text-zinc-900 outline-none focus:ring-2 focus:ring-orange-600 bg-white" disabled={isPending(`material-${item.id}`)} value={qtdEditada} onChange={(e) => setQtdEditada(e.target.value)} placeholder="Qtd" />
                            <div className="flex gap-2 w-full sm:w-auto">
                              <button disabled={isPending(`material-${item.id}`)} onClick={() => setMaterialEditando(null)} className="flex-1 bg-zinc-200 text-zinc-800 p-3 rounded-lg font-bold hover:bg-zinc-300 flex items-center justify-center"><X size={18}/></button>
                              <button disabled={isPending(`material-${item.id}`)} onClick={() => salvarEdicaoMaterial(item.id)} className="flex-1 bg-emerald-600 text-white p-3 rounded-lg font-bold hover:bg-emerald-700 flex items-center justify-center"><Save size={18}/></button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-bold text-zinc-900 text-lg">{item.nome}</p>
                                <span className="inline-block bg-orange-100 text-orange-800 py-1 px-3 rounded-full font-bold text-xs mt-1">{item.quantidade}</span>
                              </div>
                              <div className="flex gap-1">
                                <button disabled={isPending(`material-${item.id}`)} onClick={() => iniciarEdicaoMaterial(item)} className="p-2 text-zinc-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"><Edit2 size={18} /></button>
                                <button disabled={isPending(`material-${item.id}`)} onClick={() => confirmarExclusaoMaterial(item.id)} className="p-2 text-zinc-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={18} /></button>
                              </div>
                            </div>
                            <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-xl border border-zinc-200 mt-1">
                              <label className="text-xs font-bold text-zinc-600 uppercase tracking-wide">Custo Registrado</label>
                              <div className="flex items-center text-emerald-800 font-bold bg-white px-3 py-1.5 rounded-lg border border-zinc-300 shadow-sm focus-within:ring-2 focus-within:ring-emerald-600 transition-all">
                                <span className="text-zinc-500 mr-1 text-sm">R$</span>
                                <input type="text" inputMode="decimal" disabled={isPending(`material-${item.id}`)} value={precosEditados[item.id] ?? (item.preco_total ? item.preco_total.toString().replace(".", ",") : "")} onChange={(e) => setPrecosEditados(prev => ({ ...prev, [item.id]: e.target.value }))} placeholder="0,00" onBlur={(e) => atualizarPreco(item.id, e.target.value)} className="w-20 text-right outline-none bg-transparent placeholder-zinc-400" />
                              </div>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              <div className="p-4 bg-zinc-50 border-t border-zinc-200">
                <Link href="/calcular" className="flex items-center justify-center gap-2 w-full bg-orange-100 text-orange-800 font-bold p-4 rounded-xl hover:bg-orange-200 transition-colors">
                  <Calculator size={20} /> Nova Medição
                </Link>
              </div>
            </div>

            {/* Botão do WhatsApp no Mobile */}
            {materiais.length > 0 && (
              <button onClick={solicitarOrcamentoWhatsApp} className="lg:hidden w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold p-4 rounded-xl hover:bg-[#128C7E] transition shadow-sm">
                <MessageCircle size={20} /> Pedir Cotação no WhatsApp
              </button>
            )}
          </div>

          {/* COLUNA 2: FINANCEIRO E CAIXA */}
          <div className={`${abaAtiva === "caixa" ? "block" : "hidden"} lg:block space-y-6`}>
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col max-h-175">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center gap-2">
                <Wallet size={20} className="text-emerald-700" />
                <h2 className="font-bold text-zinc-900">Caixa da Obra</h2>
              </div>
              
              <div className="p-4 border-b border-zinc-200 bg-white">
                <form onSubmit={registrarTransacao} className="flex flex-col gap-3">
                  <select className="p-3 border border-zinc-300 rounded-xl text-sm font-bold outline-none bg-zinc-50 text-zinc-900 focus:ring-2 focus:ring-emerald-600" disabled={salvandoCaixa} value={novaTransacao.tipo} onChange={(e) => setNovaTransacao({ ...novaTransacao, tipo: e.target.value as "RECEBIMENTO_CLIENTE" | "PAGAMENTO_FUNCIONARIO", funcionario_id: "" })}>
                    <option value="RECEBIMENTO_CLIENTE">Entrada: Dinheiro do Cliente</option>
                    <option value="PAGAMENTO_FUNCIONARIO">Saída: Pagamento da Equipe</option>
                  </select>

                  {novaTransacao.tipo === "PAGAMENTO_FUNCIONARIO" && (
                    <select className="p-3 border border-zinc-300 rounded-xl text-sm outline-none bg-white text-zinc-900 focus:ring-2 focus:ring-emerald-600" disabled={salvandoCaixa} value={novaTransacao.funcionario_id} onChange={(e) => handleSelecionarFuncionario(e.target.value)} required>
                      <option value="" disabled hidden>Selecione o profissional...</option>
                      {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} (Diária: R$ {f.valor_diaria})</option>)}
                    </select>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <input 
                      type="text" 
                      className="sm:w-1/2 p-3 border border-zinc-300 rounded-xl text-sm text-zinc-900 placeholder-zinc-500 outline-none focus:ring-2 focus:ring-emerald-600 transition-all" 
                      placeholder={novaTransacao.tipo === "RECEBIMENTO_CLIENTE" ? "Ex: Sinal / 1ª Parcela" : "Ex: Adiantamento / 3 dias"} 
                      disabled={salvandoCaixa} value={novaTransacao.descricao}
                      onChange={(e) => setNovaTransacao({ ...novaTransacao, descricao: e.target.value })} 
                      required 
                    />
                    {/* VALOR */}
                    <div className="flex items-center bg-white border border-zinc-300 rounded-xl px-3 sm:w-44 focus-within:ring-2 focus-within:ring-emerald-600 transition-all">
                      <span className="text-zinc-700 text-sm font-bold">R$</span>
                      <input 
                        type="text" 
                        inputMode="decimal" 
                        className="w-full py-3 pl-2 outline-none text-right text-sm font-bold text-zinc-900 placeholder-zinc-400 bg-transparent" 
                        disabled={salvandoCaixa} value={novaTransacao.valor}
                        onChange={(e) => setNovaTransacao({ ...novaTransacao, valor: e.target.value })} 
                        placeholder="0,00" 
                        required 
                      />
                    </div>
                  </div>
                  
                  <button type="submit" disabled={salvandoCaixa} className="bg-emerald-700 text-white font-bold p-3 rounded-xl hover:bg-emerald-800 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50 mt-1 shadow-sm">
                    <Plus size={16}/> Lançar no Caixa
                  </button>
                </form>
              </div>

              <div className="overflow-y-auto flex-1 p-3">
                {transacoes.length === 0 ? <p className="text-center text-zinc-600 font-medium py-6 text-sm">Nenhuma movimentação.</p> : (
                  <ul className="space-y-2">
                    {transacoes.map(t => (
                      <li key={t.id} className="p-3 border border-zinc-200 rounded-xl flex justify-between items-center bg-white shadow-sm hover:border-zinc-300 transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            {t.tipo === "RECEBIMENTO_CLIENTE" ? <TrendingUp size={16} className="text-emerald-700"/> : <TrendingDown size={16} className="text-red-700"/>}
                            <span className="font-bold text-zinc-900 text-sm">{t.tipo === "RECEBIMENTO_CLIENTE" ? "Recebimento" : t.funcionarios?.nome || "Equipe"}</span>
                          </div>
                          <p className="text-xs font-medium text-zinc-600 mt-1 truncate max-w-37.5">{t.descricao}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`font-black text-sm ${t.tipo === "RECEBIMENTO_CLIENTE" ? "text-emerald-700" : "text-red-700"}`}>
                            {t.tipo === "RECEBIMENTO_CLIENTE" ? "+" : "-"} R$ {t.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                          </span>
                          <button disabled={isPending(`transacao-${t.id}`)} onClick={() => excluirTransacao(t.id)} className="text-zinc-500 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* COLUNA 3: TAREFAS */}
          <div className={`${abaAtiva === "tarefas" ? "block" : "hidden"} lg:block space-y-6`}>
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col max-h-175">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center gap-2">
                <CheckSquare size={20} className="text-blue-700" />
                <h2 className="font-bold text-zinc-900">Checklist da Obra</h2>
              </div>

              <div className="p-4 border-b border-zinc-200 bg-white">
                <form onSubmit={criarTarefa} className="flex gap-2">
                  <input type="text" className="flex-1 p-3 border border-zinc-300 rounded-xl text-zinc-900 outline-none focus:ring-2 focus:ring-blue-600 transition-all bg-zinc-50 focus:bg-white placeholder-zinc-500" placeholder="O que precisa ser feito?" disabled={salvandoTarefa} value={novaTarefa} onChange={(e) => setNovaTarefa(e.target.value)} />
                  <button type="submit" disabled={salvandoTarefa || !novaTarefa.trim()} className="bg-zinc-900 text-white px-4 rounded-xl font-bold hover:bg-zinc-800 transition disabled:opacity-50">
                    <Plus size={20} />
                  </button>
                </form>
              </div>

              <div className="overflow-y-auto p-4 flex-1">
                {tarefas.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center">
                    <CheckSquare size={32} className="text-zinc-400 mb-2" />
                    <p className="text-zinc-600 font-medium">Sua lista está vazia.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tarefas.map((tarefa) => (
                      <button type="button" disabled={isPending(`tarefa-${tarefa.id}`)} aria-pressed={tarefa.concluida} key={tarefa.id} onClick={() => alternarConclusao(tarefa.id, tarefa.concluida)} className={`w-full text-left disabled:opacity-50 p-4 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${tarefa.concluida ? "bg-emerald-50 border-emerald-200" : "bg-white border-zinc-200 hover:border-blue-400 shadow-sm hover:shadow"}`}>
                        <span className={`shrink-0 w-6 h-6 rounded flex items-center justify-center border transition-colors ${tarefa.concluida ? "bg-emerald-600 border-emerald-600 text-white" : "border-zinc-300 bg-zinc-50"}`}>
                          {tarefa.concluida && <Check size={14} strokeWidth={3} />}
                        </span>
                        <span className={`text-sm md:text-base font-semibold transition-all select-none ${tarefa.concluida ? "line-through text-emerald-700/80" : "text-zinc-800"}`}>
                          {tarefa.nome}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
