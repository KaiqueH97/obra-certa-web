"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase"; 
import Link from "next/link";

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
  const [abaAtiva, setAbaAtiva] = useState<"materiais" | "tarefas">("materiais");
  const [materialEditando, setMaterialEditando] = useState<number | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [qtdEditada, setQtdEditada] = useState("");

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

    setCarregando(false);
  };

  useEffect(() => {
    carregarDadosDaObra();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId]);

  // Função intacta com o tratamento de erros que fizemos
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
      alert("Erro do banco de dados: " + error.message);
      console.error("Detalhe do erro:", error);
    } else if (data && data.length === 0) {
      alert("Aviso: O preço não foi salvo! O Supabase bloqueou a edição (Provavelmente falta configurar o RLS de UPDATE na tabela materiais_projeto).");
    }
  };

  const iniciarEdicaoMaterial = (item: Material) => {
    setMaterialEditando(item.id);
    setNomeEditado(item.nome);
    setQtdEditada(item.quantidade);
  };

  const salvarEdicaoMaterial = async (id: number) => {
    setMateriais(prev => prev.map(item => 
      item.id === id ? { ...item, nome: nomeEditado, quantidade: qtdEditada } : item
    ));

    const { error } = await supabase
      .from("materiais_projeto")
      .update({ nome: nomeEditado, quantidade: qtdEditada })
      .eq("id", id);

    if (error) {
      alert("Erro ao atualizar material: " + error.message);
      carregarDadosDaObra();
    }
    setMaterialEditando(null);
  };

  const excluirMaterial = async (id: number) => {
    if (!window.confirm("Deseja excluir este material do orçamento?")) return;

    setMateriais(prev => prev.filter(item => item.id !== id));
    
    const { error } = await supabase.from("materiais_projeto").delete().eq("id", id);

    if (error) {
      alert("Erro ao excluir: " + error.message);
      carregarDadosDaObra();
    }
  };

  const criarTarefa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTarefa) return;
    const { error } = await supabase.from("tarefas").insert([{ nome: novaTarefa, projeto_id: projetoId }]);
    if (!error) {
      setNovaTarefa("");
      const { data } = await supabase.from("tarefas").select("*").eq("projeto_id", projetoId).order("criado_em", { ascending: true });
      if (data) setTarefas(data);
    }
  };

  const alternarConclusao = async (id: number, statusAtual: boolean) => {
    const { error } = await supabase.from("tarefas").update({ concluida: !statusAtual }).eq("id", id);
    if (!error) {
      setTarefas(prev => prev.map(t => t.id === id ? { ...t, concluida: !statusAtual } : t));
    }
  };

  const solicitarOrcamentoWhatsApp = () => {
    let textoMensagem = `*Obra Certa - Orçamento: ${tituloObra}*\n\n`;
    materiais.forEach(item => textoMensagem += `- ${item.nome}: ${item.quantidade}\n`);
    window.open(`https://wa.me/?text=${encodeURIComponent(textoMensagem)}`, "_blank");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6 flex flex-col items-center pb-20">
      <div className="w-full max-w-md mt-4 animate-fade-in">
        
        {/* Cabeçalho Fixo */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 truncate pr-2">{tituloObra}</h1>
          <Link href="/projetos" className="text-orange-600 font-bold text-lg hover:underline whitespace-nowrap">
            Voltar
          </Link>
        </div>

        {/* MENU DE ABAS */}
        <div className="flex bg-gray-200 p-1 rounded-xl mb-8 shadow-inner">
          <button
            onClick={() => setAbaAtiva("materiais")}
            className={`flex-1 py-3 rounded-lg font-bold transition-all ${
              abaAtiva === "materiais" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500"
            }`}
          >
            🛒 Orçamento
          </button>
          <button
            onClick={() => setAbaAtiva("tarefas")}
            className={`flex-1 py-3 rounded-lg font-bold transition-all ${
              abaAtiva === "tarefas" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500"
            }`}
          >
            📋 Tarefas
          </button>
        </div>

        {carregando ? (
          <p className="text-center text-gray-600 mt-10">Carregando dados...</p>
        ) : (
          <div className="animate-fade-in">
            
            {/* CONTEÚDO DA ABA: MATERIAIS */}
            {abaAtiva === "materiais" && (
              <div className="space-y-6">
                <div className="bg-green-800 text-white p-6 rounded-2xl shadow-md flex flex-col items-center">
                  <span className="text-green-200 text-xs font-bold uppercase tracking-wider mb-1">Custo Total Acumulado</span>
                  <span className="text-4xl font-black">
                    R$ {custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="space-y-4">
                  {materiais.length === 0 ? (
                    <p className="text-center text-gray-500 bg-white p-10 rounded-xl border border-gray-200">
                      Nenhum material calculado para esta obra.
                    </p>
                  ) : (
                    <ul className="space-y-4">
                      {materiais.map((item) => (
                        <li key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-3">
                          
                          {materialEditando === item.id ? (
                            /* MODO EDIÇÃO MATERIAL */
                            <div className="flex flex-col gap-3 bg-orange-50 p-2 rounded-lg border border-orange-100">
                              <input 
                                className="w-full p-2 border border-orange-300 rounded text-black font-bold outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                                value={nomeEditado}
                                onChange={(e) => setNomeEditado(e.target.value)}
                                placeholder="Nome do material"
                              />
                              <input 
                                className="w-full p-2 border border-orange-300 rounded text-black outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                                value={qtdEditada}
                                onChange={(e) => setQtdEditada(e.target.value)}
                                placeholder="Quantidade"
                              />
                              <div className="flex gap-2 mt-1">
                                <button onClick={() => setMaterialEditando(null)} className="flex-1 bg-gray-200 text-gray-800 p-2 rounded-lg font-bold hover:bg-gray-300 transition">Cancelar</button>
                                <button onClick={() => salvarEdicaoMaterial(item.id)} className="flex-1 bg-green-600 text-white p-2 rounded-lg font-bold hover:bg-green-700 transition">Salvar</button>
                              </div>
                            </div>
                          ) : (
                            /* MODO VISUALIZAÇÃO MATERIAL */
                            <>
                              <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                  <p className="font-bold text-gray-800 text-lg">{item.nome}</p>
                                  <span className="bg-yellow-100 text-yellow-800 py-1 px-3 rounded-full font-bold text-xs italic mt-1 w-fit">
                                    {item.quantidade}
                                  </span>
                                </div>
                                {/* Botões Editar/Excluir */}
                                <div className="flex flex-col gap-2">
                                  <button onClick={() => iniciarEdicaoMaterial(item)} className="text-blue-600 font-bold text-xs hover:underline flex items-center justify-end gap-1">✏️ Editar</button>
                                  <button onClick={() => excluirMaterial(item.id)} className="text-red-600 font-bold text-xs hover:underline flex items-center justify-end gap-1">🗑️ Excluir</button>
                                </div>
                              </div>
                              
                              <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                                <label className="text-xs font-bold text-gray-500 uppercase">Preço Total:</label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  defaultValue={item.preco_total ? item.preco_total.toString().replace(".", ",") : ""}
                                  placeholder="0,00"
                                  onBlur={(e) => atualizarPreco(item.id, e.target.value)}
                                  className="w-24 p-1 text-right border-b-2 border-gray-200 font-bold text-green-700 outline-none focus:border-green-500 bg-transparent"
                                />
                              </div>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  <Link 
                    href="/calcular"
                    className="block w-full text-center bg-yellow-600 text-white font-bold p-4 rounded-xl hover:bg-yellow-700 transition"
                  >
                    + Novo Cálculo de Material
                  </Link>

                  {materiais.length > 0 && (
                    <button 
                      onClick={solicitarOrcamentoWhatsApp}
                      className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold p-4 rounded-xl hover:bg-[#128C7E] transition"
                    >
                      Pedir Cotação no WhatsApp
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* CONTEÚDO DA ABA: TAREFAS */}
            {abaAtiva === "tarefas" && (
              <div className="space-y-6">
                <form onSubmit={criarTarefa} className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 p-4 border border-gray-300 rounded-xl text-black outline-none focus:ring-2 focus:ring-orange-600 shadow-sm"
                    placeholder="O que precisa ser feito?"
                    value={novaTarefa}
                    onChange={(e) => setNovaTarefa(e.target.value)}
                  />
                  <button type="submit" className="bg-slate-800 text-white font-bold px-6 rounded-xl hover:bg-slate-900 transition">
                    Add
                  </button>
                </form>

                {tarefas.length === 0 ? (
                  <p className="text-center text-gray-500 py-10">Sua lista de tarefas está vazia.</p>
                ) : (
                  <div className="grid gap-3">
                    {tarefas.map((tarefa) => (
                      <div 
                        key={tarefa.id} 
                        onClick={() => alternarConclusao(tarefa.id, tarefa.concluida)}
                        className={`p-5 rounded-xl border cursor-pointer flex items-center gap-4 transition-all ${
                          tarefa.concluida ? "bg-green-50 border-green-200 opacity-60" : "bg-white border-gray-200 shadow-sm"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded flex items-center justify-center border-2 ${
                          tarefa.concluida ? "bg-green-500 border-green-500 text-white" : "border-gray-300"
                        }`}>
                          {tarefa.concluida && "✓"}
                        </div>
                        <span className={`text-lg font-bold ${tarefa.concluida ? "line-through text-green-900" : "text-gray-800"}`}>
                          {tarefa.nome}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}