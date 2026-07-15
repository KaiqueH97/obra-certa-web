"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase"; 
import Link from "next/link";
import toast from "react-hot-toast";
import { 
  ArrowLeft, ShoppingCart, CheckSquare, MessageCircle, 
  Edit2, Trash2, Plus, DollarSign, Calculator, X, Save, Check
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

export default function DetalhesDoProjeto() {
  const params = useParams();
  const projetoId = params.id;
  const [tituloObra, setTituloObra] = useState("Carregando...");
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [novaTarefa, setNovaTarefa] = useState("");
  const [carregando, setCarregando] = useState(true);  
  
  // Aba ativa apenas para controle no Mobile
  const [abaAtiva, setAbaAtiva] = useState<"materiais" | "tarefas">("materiais");
  
  const [materialEditando, setMaterialEditando] = useState<number | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [qtdEditada, setQtdEditada] = useState("");
  
  const [nomeProfissional, setNomeProfissional] = useState("Profissional");
  const [telefoneContato, setTelefoneContato] = useState("");

  const custoTotal = materiais.reduce((acumulador, item) => {
    const valor = typeof item.preco_total === 'string' 
      ? parseFloat(item.preco_total) 
      : item.preco_total;
    return acumulador + (valor || 0);
  }, 0);

  const carregarDadosDaObra = async () => {
    if (!projetoId) return;
    setCarregando(true);
    
    const { data: dadosProjeto } = await supabase.from("projetos").select("titulo").eq("id", projetoId).single();
    if (dadosProjeto) setTituloObra(dadosProjeto.titulo);

    const { data: dadosTarefas } = await supabase.from("tarefas").select("*").eq("projeto_id", projetoId).order("criado_em", { ascending: true });
    if (dadosTarefas) setTarefas(dadosTarefas);

    const { data: dadosMateriais } = await supabase.from("materiais_projeto").select("*").eq("projeto_id", projetoId).order("id", { ascending: false });
    if (dadosMateriais) setMateriais(dadosMateriais);

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

    setMateriais(prev => prev.map(item => 
      item.id === id ? { ...item, preco_total: precoFinal } : item
    ));

    const { data, error } = await supabase
      .from("materiais_projeto")
      .update({ preco_total: precoFinal })
      .eq("id", id)
      .select();

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
    
    setMateriais(prev => prev.map(item => 
      item.id === id ? { ...item, nome: nomeEditado, quantidade: qtdEditada } : item
    ));

    const { error } = await supabase
      .from("materiais_projeto")
      .update({ nome: nomeEditado, quantidade: qtdEditada })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar: " + error.message, { id: toastId });
      carregarDadosDaObra();
    } else {
      toast.success("Material atualizado!", { id: toastId });
    }
    setMaterialEditando(null);
  };

  const confirmarExclusaoMaterial = (id: number) => {
    toast(
      (t) => (
        <div className="flex flex-col gap-2">
          <p className="font-bold text-zinc-900 text-lg">Excluir material?</p>
          <p className="text-sm text-zinc-600 mb-2">Ele será removido permanentemente deste orçamento.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => toast.dismiss(t.id)} className="px-4 py-2 bg-zinc-200 text-zinc-800 rounded-lg font-bold hover:bg-zinc-300 transition-colors">
              Cancelar
            </button>
            <button onClick={() => { toast.dismiss(t.id); executarExclusaoMaterial(id); }} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors">
              Sim, Excluir
            </button>
          </div>
        </div>
      ),
      { duration: Infinity, id: 'exclusao-toast' } // Adicionado ID para evitar duplicação do toast
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
      const { data } = await supabase.from("tarefas").select("*").eq("projeto_id", projetoId).order("criado_em", { ascending: true });
      if (data) setTarefas(data);
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
    
    materiais.forEach(item => {
      textoMensagem += `${e.bullet} *${item.nome}:* ${item.quantidade}\n`;
    });

    textoMensagem += `\n*${e.bulb} Obra Certa:* Planejamento inteligente, transparência e sem desperdício.\nQualquer dúvida sobre as medidas, estou à disposição!\n`;
    if (telefoneContato) textoMensagem += `${e.phone} Contato: ${telefoneContato}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(textoMensagem)}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER PRINCIPAL */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/projetos" className="p-2 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 hover:text-zinc-900 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight">{tituloObra}</h1>
            <p className="text-sm md:text-base text-zinc-500 mt-1">Gestão de materiais e acompanhamento de tarefas.</p>
          </div>
        </div>

        {/* Botão do WhatsApp (Visível no Header no Desktop) */}
        {materiais.length > 0 && !carregando && (
          <button 
            onClick={solicitarOrcamentoWhatsApp}
            className="hidden md:flex items-center justify-center gap-2 bg-[#25D366] text-white px-5 py-3 rounded-xl hover:bg-[#128C7E] transition-colors shadow-sm font-bold"
          >
            <MessageCircle size={20} />
            Enviar Relatório via WhatsApp
          </button>
        )}
      </div>

      {/* MENU DE ABAS (Exclusivo para Mobile) */}
      <div className="md:hidden flex bg-zinc-200/50 p-1 rounded-xl shadow-inner">
        <button
          onClick={() => setAbaAtiva("materiais")}
          className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-lg font-bold transition-all ${
            abaAtiva === "materiais" ? "bg-white text-orange-600 shadow-sm" : "text-zinc-500"
          }`}
        >
          <ShoppingCart size={18} /> Orçamento
        </button>
        <button
          onClick={() => setAbaAtiva("tarefas")}
          className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-lg font-bold transition-all ${
            abaAtiva === "tarefas" ? "bg-white text-orange-600 shadow-sm" : "text-zinc-500"
          }`}
        >
          <CheckSquare size={18} /> Tarefas
        </button>
      </div>

      {carregando ? (
        <div className="p-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      ) : (
        /* GRID RESPONSIVO: Abas no Mobile vs Colunas no Desktop */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* COLUNA ESQUERDA: MATERIAIS E ORÇAMENTO */}
          {/* No mobile, só aparece se abaAtiva for 'materiais'. No desktop (md:), aparece sempre ocupando 7 colunas */}
          <div className={`${abaAtiva === "materiais" ? "block" : "hidden"} md:block md:col-span-7 space-y-6`}>
            
            {/* Card de Custo Total */}
            <div className="bg-linear-to-br from-emerald-800 to-emerald-950 text-white p-6 rounded-2xl shadow-md flex items-center justify-between border border-emerald-900">
              <div>
                <span className="text-emerald-200 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                  <DollarSign size={14} /> Custo Acumulado
                </span>
                <span className="text-4xl font-black">
                  R$ {custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Lista de Materiais */}
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center">
                <h2 className="font-bold text-zinc-900">Lista de Materiais</h2>
              </div>
              
              {materiais.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center">
                  <ShoppingCart size={40} className="text-zinc-300 mb-3" />
                  <p className="text-zinc-500 font-medium">Nenhum material adicionado.</p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {materiais.map((item) => (
                    <li key={item.id} className="p-4 flex flex-col gap-3 hover:bg-zinc-50 transition-colors">
                      
                      {materialEditando === item.id ? (
                        /* Modo Edição */
                        <div className="flex flex-col sm:flex-row gap-3 bg-orange-50 p-3 rounded-xl border border-orange-200 animate-in fade-in">
                          <input 
                            className="flex-1 p-3 border border-orange-300 rounded-lg text-zinc-900 outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                            value={nomeEditado}
                            onChange={(e) => setNomeEditado(e.target.value)}
                            placeholder="Nome do material"
                          />
                          <input 
                            className="w-full sm:w-32 p-3 border border-orange-300 rounded-lg text-zinc-900 outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                            value={qtdEditada}
                            onChange={(e) => setQtdEditada(e.target.value)}
                            placeholder="Qtd"
                          />
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button onClick={() => setMaterialEditando(null)} className="flex-1 bg-zinc-200 text-zinc-700 p-3 rounded-lg font-bold hover:bg-zinc-300 transition flex items-center justify-center"><X size={18}/></button>
                            <button onClick={() => salvarEdicaoMaterial(item.id)} className="flex-1 bg-emerald-600 text-white p-3 rounded-lg font-bold hover:bg-emerald-700 transition flex items-center justify-center"><Save size={18}/></button>
                          </div>
                        </div>
                      ) : (
                        /* Modo Visualização */
                        <>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-zinc-900 text-lg">{item.nome}</p>
                              <span className="inline-block bg-orange-100 text-orange-800 py-1 px-3 rounded-full font-bold text-xs mt-1">
                                {item.quantidade}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => iniciarEdicaoMaterial(item)} className="p-2 text-zinc-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"><Edit2 size={18} /></button>
                              <button onClick={() => confirmarExclusaoMaterial(item.id)} className="p-2 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={18} /></button>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center bg-zinc-50/80 p-3 rounded-xl border border-zinc-200/60 mt-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Custo Registrado</label>
                            <div className="flex items-center text-emerald-700 font-bold bg-white px-3 py-1.5 rounded-lg border border-zinc-200 shadow-sm focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
                              <span className="text-zinc-400 mr-1 text-sm">R$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                defaultValue={item.preco_total ? item.preco_total.toString().replace(".", ",") : ""}
                                placeholder="0,00"
                                onBlur={(e) => atualizarPreco(item.id, e.target.value)}
                                className="w-20 text-right outline-none bg-transparent placeholder-zinc-300"
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              
              <div className="p-4 bg-zinc-50 border-t border-zinc-100">
                <Link 
                  href="/calcular"
                  className="flex items-center justify-center gap-2 w-full bg-orange-100 text-orange-700 font-bold p-4 rounded-xl hover:bg-orange-200 transition-colors"
                >
                  <Calculator size={20} />
                  Nova Medição
                </Link>
              </div>
            </div>

            {/* Botão do WhatsApp no Mobile */}
            {materiais.length > 0 && (
              <button 
                onClick={solicitarOrcamentoWhatsApp}
                className="md:hidden w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold p-4 rounded-xl hover:bg-[#128C7E] transition shadow-sm"
              >
                <MessageCircle size={20} /> Pedir Cotação no WhatsApp
              </button>
            )}
          </div>

          {/* COLUNA DIREITA: TAREFAS */}
          {/* No mobile, só aparece se abaAtiva for 'tarefas'. No desktop (md:), aparece sempre ocupando 5 colunas */}
          <div className={`${abaAtiva === "tarefas" ? "block" : "hidden"} md:block md:col-span-5 space-y-6`}>
            
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden flex flex-col h-full max-h-200">
              <div className="p-4 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
                <CheckSquare size={20} className="text-orange-600" />
                <h2 className="font-bold text-zinc-900">Checklist da Obra</h2>
              </div>

              {/* Input Nova Tarefa */}
              <div className="p-4 border-b border-zinc-100 bg-white">
                <form onSubmit={criarTarefa} className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 p-3 border border-zinc-300 rounded-xl text-zinc-900 outline-none focus:ring-2 focus:ring-orange-600 transition-all bg-zinc-50 focus:bg-white"
                    placeholder="O que precisa ser feito?"
                    value={novaTarefa}
                    onChange={(e) => setNovaTarefa(e.target.value)}
                  />
                  <button type="submit" disabled={!novaTarefa.trim()} className="bg-zinc-900 text-white px-4 rounded-xl font-bold hover:bg-zinc-800 transition disabled:opacity-50">
                    <Plus size={20} />
                  </button>
                </form>
              </div>

              {/* Lista de Tarefas */}
              <div className="overflow-y-auto p-4 flex-1">
                {tarefas.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center">
                    <CheckSquare size={32} className="text-zinc-300 mb-2" />
                    <p className="text-zinc-500 font-medium">Sua lista está vazia.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tarefas.map((tarefa) => (
                      <div 
                        key={tarefa.id} 
                        onClick={() => alternarConclusao(tarefa.id, tarefa.concluida)}
                        className={`p-4 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                          tarefa.concluida ? "bg-emerald-50/50 border-emerald-100" : "bg-white border-zinc-200 hover:border-orange-300 shadow-sm hover:shadow"
                        }`}
                      >
                        <div className={`shrink-0 w-6 h-6 rounded flex items-center justify-center border transition-colors ${
                          tarefa.concluida ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-300 bg-zinc-50"
                        }`}>
                          {tarefa.concluida && <Check size={14} strokeWidth={3} />}
                        </div>
                        <span className={`text-sm md:text-base font-semibold transition-all select-none ${tarefa.concluida ? "line-through text-emerald-700/60" : "text-zinc-800"}`}>
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