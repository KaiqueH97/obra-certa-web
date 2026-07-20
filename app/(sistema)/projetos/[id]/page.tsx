"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase"; 
import Link from "next/link";
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

export default function DetalhesDoProjeto() {
  const params = useParams();
  const projetoId = params.id;
  const [tituloObra, setTituloObra] = useState("Carregando...");
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [novaTarefa, setNovaTarefa] = useState("");
  const [carregando, setCarregando] = useState(true);  
  
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
  const [salvandoCaixa, setSalvandoCaixa] = useState(false);

  // Cálculos Automáticos
  const custoMateriais = materiais.reduce((acumulador, item) => {
    const valor = typeof item.preco_total === 'string' ? parseFloat(item.preco_total) : item.preco_total;
    return acumulador + (valor || 0);
  }, 0);

  const totalRecebido = transacoes.filter(t => t.tipo === "RECEBIMENTO_CLIENTE").reduce((acc, item) => acc + item.valor, 0);
  const totalMaoDeObra = transacoes.filter(t => t.tipo === "PAGAMENTO_FUNCIONARIO").reduce((acc, item) => acc + item.valor, 0);
  const lucroAtual = totalRecebido - custoMateriais - totalMaoDeObra;

  const carregarDadosDaObra = async () => {
    if (!projetoId) return;
    setCarregando(true);
    
    const { data: dadosProjeto } = await supabase.from("projetos").select("titulo").eq("id", projetoId).single();
    if (dadosProjeto) setTituloObra(dadosProjeto.titulo);

    const { data: dadosTarefas } = await supabase.from("tarefas").select("*").eq("projeto_id", projetoId).order("criado_em", { ascending: true });
    if (dadosTarefas) setTarefas(dadosTarefas);

    const { data: dadosMateriais } = await supabase.from("materiais_projeto").select("*").eq("projeto_id", projetoId).order("id", { ascending: false });
    if (dadosMateriais) setMateriais(dadosMateriais);

    // Buscando dados financeiros
    const { data: trans } = await supabase.from("financeiro_obra").select("*, funcionarios(nome)").eq("projeto_id", projetoId).order("id", { ascending: false });
    if (trans) setTransacoes(trans);

    const { data: func } = await supabase.from("funcionarios").select("id, nome, valor_diaria").order("nome");
    if (func) setFuncionarios(func);

    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.user_metadata) {
      if (user.user_metadata.nome) setNomeProfissional(user.user_metadata.nome);
      if (user.user_metadata.telefone) setTelefoneContato(user.user_metadata.telefone);
    }

    setCarregando(false);
  };

  useEffect(() => {
    carregarDadosDaObra();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId]);

  const atualizarPreco = async (id: number, valorDigitado: string) => {
    const valorLimpo = valorDigitado.replace(/\./g, "").replace(",", ".");
    const precoNumerico = parseFloat(valorLimpo);
    const precoFinal = isNaN(precoNumerico) ? 0 : precoNumerico;

    setMateriais(prev => prev.map(item => item.id === id ? { ...item, preco_total: precoFinal } : item));
    const { data, error } = await supabase.from("materiais_projeto").update({ preco_total: precoFinal }).eq("id", id).select();

    if (error) {
      toast.error("Erro do banco de dados: " + error.message);
    } else if (data && data.length === 0) {
      toast.error("O preço não foi salvo! Verifique as permissões.");
    } else {
      toast.success("Preço salvo com sucesso!", { duration: 1500 });
    }
  };

  const iniciarEdicaoMaterial = (item: Material) => {
    setMaterialEditando(item.id);
    setNomeEditado(item.nome);
    setQtdEditada(item.quantidade);
  };

  const salvarEdicaoMaterial = async (id: number) => {
    const toastId = toast.loading("Salvando alterações...");
    setMateriais(prev => prev.map(item => item.id === id ? { ...item, nome: nomeEditado, quantidade: qtdEditada } : item));
    const { error } = await supabase.from("materiais_projeto").update({ nome: nomeEditado, quantidade: qtdEditada }).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar: " + error.message, { id: toastId });
      carregarDadosDaObra();
    } else {
      toast.success("Material atualizado!", { id: toastId });
    }
    setMaterialEditando(null);
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
    const toastId = toast.loading("Removendo material...");
    setMateriais(prev => prev.filter(item => item.id !== id));
    const { error } = await supabase.from("materiais_projeto").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message, { id: toastId });
      carregarDadosDaObra();
    } else {
      toast.success("Material excluído!", { id: toastId });
    }
  };

  const criarTarefa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTarefa) return;
    const { error } = await supabase.from("tarefas").insert([{ nome: novaTarefa, projeto_id: projetoId }]);
    if (!error) {
      setNovaTarefa("");
      toast.success("Tarefa adicionada!", { duration: 1500 });
      carregarDadosDaObra();
    } else {
      toast.error("Erro ao criar tarefa: " + error.message);
    }
  };

  const alternarConclusao = async (id: number, statusAtual: boolean) => {
    setTarefas(prev => prev.map(t => t.id === id ? { ...t, concluida: !statusAtual } : t));
    const { error } = await supabase.from("tarefas").update({ concluida: !statusAtual }).eq("id", id);
    if (error) toast.error("Erro ao atualizar tarefa.");
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
      setNovaTransacao({ ...novaTransacao, funcionario_id: idStr, valor: func.valor_diaria.toString().replace(".", ",") });
    } else {
      setNovaTransacao({ ...novaTransacao, funcionario_id: idStr });
    }
  };

  const registrarTransacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTransacao.valor || !novaTransacao.descricao) return toast.error("Preencha o valor e a descrição.");
    
    setSalvandoCaixa(true);
    const toastId = toast.loading("Registrando no caixa...");
    const valorNum = parseFloat(novaTransacao.valor.replace(/\./g, "").replace(",", "."));

  const payload: {
      projeto_id: string;
      tipo: string;
      valor: number;
      descricao: string;
      funcionario_id?: number;
    } = { 
      projeto_id: projetoId as string, 
      tipo: novaTransacao.tipo, 
      valor: isNaN(valorNum) ? 0 : valorNum, 
      descricao: novaTransacao.descricao 
    };
    if (novaTransacao.tipo === "PAGAMENTO_FUNCIONARIO" && novaTransacao.funcionario_id) {
      payload.funcionario_id = parseInt(novaTransacao.funcionario_id);
    }

    const { error } = await supabase.from("financeiro_obra").insert([payload]);

    if (!error) {
      toast.success("Lançamento registrado!", { id: toastId });
      setNovaTransacao({ tipo: "RECEBIMENTO_CLIENTE", valor: "", descricao: "", funcionario_id: "" });
      carregarDadosDaObra(); 
    } else {
      toast.error("Erro: " + error.message, { id: toastId });
    }
    setSalvandoCaixa(false);
  };

  const excluirTransacao = async (id: number) => {
    setTransacoes(prev => prev.filter(t => t.id !== id));
    await supabase.from("financeiro_obra").delete().eq("id", id);
    toast.success("Lançamento removido.");
  };

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
                            <input className="flex-1 p-3 border border-orange-300 rounded-lg text-zinc-900 outline-none focus:ring-2 focus:ring-orange-600 bg-white" value={nomeEditado} onChange={(e) => setNomeEditado(e.target.value)} placeholder="Nome" />
                            <input className="w-full sm:w-32 p-3 border border-orange-300 rounded-lg text-zinc-900 outline-none focus:ring-2 focus:ring-orange-600 bg-white" value={qtdEditada} onChange={(e) => setQtdEditada(e.target.value)} placeholder="Qtd" />
                            <div className="flex gap-2 w-full sm:w-auto">
                              <button onClick={() => setMaterialEditando(null)} className="flex-1 bg-zinc-200 text-zinc-800 p-3 rounded-lg font-bold hover:bg-zinc-300 flex items-center justify-center"><X size={18}/></button>
                              <button onClick={() => salvarEdicaoMaterial(item.id)} className="flex-1 bg-emerald-600 text-white p-3 rounded-lg font-bold hover:bg-emerald-700 flex items-center justify-center"><Save size={18}/></button>
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
                                <button onClick={() => iniciarEdicaoMaterial(item)} className="p-2 text-zinc-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"><Edit2 size={18} /></button>
                                <button onClick={() => confirmarExclusaoMaterial(item.id)} className="p-2 text-zinc-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={18} /></button>
                              </div>
                            </div>
                            <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-xl border border-zinc-200 mt-1">
                              <label className="text-xs font-bold text-zinc-600 uppercase tracking-wide">Custo Registrado</label>
                              <div className="flex items-center text-emerald-800 font-bold bg-white px-3 py-1.5 rounded-lg border border-zinc-300 shadow-sm focus-within:ring-2 focus-within:ring-emerald-600 transition-all">
                                <span className="text-zinc-500 mr-1 text-sm">R$</span>
                                <input type="text" inputMode="decimal" defaultValue={item.preco_total ? item.preco_total.toString().replace(".", ",") : ""} placeholder="0,00" onBlur={(e) => atualizarPreco(item.id, e.target.value)} className="w-20 text-right outline-none bg-transparent placeholder-zinc-400" />
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
                  <select className="p-3 border border-zinc-300 rounded-xl text-sm font-bold outline-none bg-zinc-50 text-zinc-900 focus:ring-2 focus:ring-emerald-600" value={novaTransacao.tipo} onChange={(e) => setNovaTransacao({ ...novaTransacao, tipo: e.target.value as "RECEBIMENTO_CLIENTE" | "PAGAMENTO_FUNCIONARIO", funcionario_id: "" })}>
                    <option value="RECEBIMENTO_CLIENTE">Entrada: Dinheiro do Cliente</option>
                    <option value="PAGAMENTO_FUNCIONARIO">Saída: Pagamento da Equipe</option>
                  </select>

                  {novaTransacao.tipo === "PAGAMENTO_FUNCIONARIO" && (
                    <select className="p-3 border border-zinc-300 rounded-xl text-sm outline-none bg-white text-zinc-900 focus:ring-2 focus:ring-emerald-600" value={novaTransacao.funcionario_id} onChange={(e) => handleSelecionarFuncionario(e.target.value)} required>
                      <option value="" disabled hidden>Selecione o profissional...</option>
                      {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} (Diária: R$ {f.valor_diaria})</option>)}
                    </select>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <input 
                      type="text" 
                      className="sm:w-1/2 p-3 border border-zinc-300 rounded-xl text-sm text-zinc-900 placeholder-zinc-500 outline-none focus:ring-2 focus:ring-emerald-600 transition-all" 
                      placeholder={novaTransacao.tipo === "RECEBIMENTO_CLIENTE" ? "Ex: Sinal / 1ª Parcela" : "Ex: Adiantamento / 3 dias"} 
                      value={novaTransacao.descricao} 
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
                        value={novaTransacao.valor} 
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
                          <button onClick={() => excluirTransacao(t.id)} className="text-zinc-500 hover:text-red-600 p-1"><Trash2 size={16}/></button>
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
                  <input type="text" className="flex-1 p-3 border border-zinc-300 rounded-xl text-zinc-900 outline-none focus:ring-2 focus:ring-blue-600 transition-all bg-zinc-50 focus:bg-white placeholder-zinc-500" placeholder="O que precisa ser feito?" value={novaTarefa} onChange={(e) => setNovaTarefa(e.target.value)} />
                  <button type="submit" disabled={!novaTarefa.trim()} className="bg-zinc-900 text-white px-4 rounded-xl font-bold hover:bg-zinc-800 transition disabled:opacity-50">
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
                      <div key={tarefa.id} onClick={() => alternarConclusao(tarefa.id, tarefa.concluida)} className={`p-4 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${tarefa.concluida ? "bg-emerald-50 border-emerald-200" : "bg-white border-zinc-200 hover:border-blue-400 shadow-sm hover:shadow"}`}>
                        <div className={`shrink-0 w-6 h-6 rounded flex items-center justify-center border transition-colors ${tarefa.concluida ? "bg-emerald-600 border-emerald-600 text-white" : "border-zinc-300 bg-zinc-50"}`}>
                          {tarefa.concluida && <Check size={14} strokeWidth={3} />}
                        </div>
                        <span className={`text-sm md:text-base font-semibold transition-all select-none ${tarefa.concluida ? "line-through text-emerald-700/80" : "text-zinc-800"}`}>
                          {tarefa.nome}
                        </span>
                      </div>
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