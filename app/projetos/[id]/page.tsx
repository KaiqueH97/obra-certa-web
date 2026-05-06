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

  const [tituloObra, setTituloObra] = useState("Carregando Obra...");
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [novaTarefa, setNovaTarefa] = useState("");
  const [carregando, setCarregando] = useState(true);

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

  const recarregarApenasTarefas = async () => {
    const { data } = await supabase.from("tarefas").select("*").eq("projeto_id", projetoId).order("criado_em", { ascending: true });
    if (data) setTarefas(data);
  };

  useEffect(() => {
    carregarDadosDaObra();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId]);

  const atualizarPreco = async (id: number, valorDigitado: string) => {
    const precoNumerico = parseFloat(valorDigitado.replace(",", "."));
    const precoFinal = isNaN(precoNumerico) ? 0 : precoNumerico;

    setMateriais(prev => prev.map(item => 
      item.id === id ? { ...item, preco_total: precoFinal } : item
    ));

    const { error } = await supabase
      .from("materiais_projeto")
      .update({ preco_total: precoFinal })
      .eq("id", id);

    if (error) {
      console.error("Erro ao salvar preço:", error.message);
      carregarDadosDaObra();
    }
  };

  const criarTarefa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTarefa) return;

    const { error } = await supabase.from("tarefas").insert([
      { nome: novaTarefa, projeto_id: projetoId }
    ]);

    if (!error) {
      setNovaTarefa("");
      recarregarApenasTarefas();
    } else {
      alert("Erro ao adicionar tarefa: " + error.message);
    }
  };

  const alternarConclusao = async (id: number, statusAtual: boolean) => {
    const { error } = await supabase.from("tarefas").update({ concluida: !statusAtual }).eq("id", id);
    if (!error) {
      recarregarApenasTarefas();
    } else {
      alert("Erro ao atualizar tarefa.");
    }
  };

  const solicitarOrcamentoWhatsApp = () => {
    if (materiais.length === 0) {
      alert("Adicione materiais à sua obra antes de pedir um orçamento.");
      return;
    }

    let textoMensagem = `*Obra Certa - Solicitação de Orçamento*\n`;
    textoMensagem += `Obra: *${tituloObra}*\n\n`;
    textoMensagem += `Olá! Gostaria de cotar os seguintes materiais:\n\n`;

    materiais.forEach((item) => {
      textoMensagem += `- ${item.nome}: ${item.quantidade}\n`;
    });

    textoMensagem += `\nAguardo o retorno com os valores. Obrigado!`;

    const textoCodificado = encodeURIComponent(textoMensagem);
    
    window.open(`https://wa.me/?text=${textoCodificado}`, "_blank");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6 flex flex-col items-center pb-20">
      <div className="w-full max-w-md mt-4 animate-fade-in">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 truncate pr-2">{tituloObra}</h1>
          <Link href="/projetos" className="text-orange-600 font-bold text-lg hover:underline whitespace-nowrap">
            Voltar
          </Link>
        </div>

        {carregando ? (
          <p className="text-center text-gray-600 text-lg mt-10">Carregando dados da obra...</p>
        ) : (
          <>
            <div className="bg-green-800 text-white p-6 rounded-2xl shadow-md mb-8 flex flex-col items-center justify-center">
              <span className="text-green-200 text-sm font-bold uppercase tracking-wider mb-1">Custo Estimado da Obra</span>
              <span className="text-4xl font-black">
                R$ {custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="mb-12">
              <div className="flex justify-between items-end mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  Materiais e Custos
                </h2>
              </div>

              {materiais.length === 0 ? (
                <p className="text-center text-gray-500 bg-white p-6 rounded-xl border border-gray-200">
                  Nenhum material salvo.
                </p>
              ) : (
                <ul className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100 mb-4">
                  {materiais.map((item) => (
                    <li key={item.id} className="p-4 flex flex-col">
                      <div className="flex justify-between items-start mb-3">
                        <p className="font-bold text-gray-800">{item.nome}</p>
                        <span className="bg-yellow-100 text-yellow-800 py-1 px-3 rounded-full font-bold text-xs">
                          {item.quantidade}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <label className="text-sm font-semibold text-gray-600">Preço Total Pago (R$):</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={item.preco_total ? item.preco_total.toString().replace(".", ",") : ""}
                          placeholder="0,00"
                          onBlur={(e) => atualizarPreco(item.id, e.target.value)}
                          className="w-24 p-2 text-right border border-gray-300 rounded font-bold text-green-700 outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              
              {/* --- BOTOES DE AÇÃO DOS MATERIAIS --- */}
              <div className="flex flex-col gap-3">
                <Link 
                  href="/calcular"
                  className="w-full text-center bg-yellow-600 text-white font-bold p-3 rounded-lg hover:bg-yellow-700 transition shadow-sm"
                >
                  + Fazer Novo Cálculo
                </Link>

                {materiais.length > 0 && (
                  <button 
                    onClick={solicitarOrcamentoWhatsApp}
                    className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold p-3 rounded-lg hover:bg-[#128C7E] transition shadow-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                    </svg>
                    Pedir Orçamento no WhatsApp
                  </button>
                )}
              </div>
            </div>

            <hr className="border-gray-300 mb-8" />

            {/* SEÇÃO 2: TAREFAS */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                Tarefas da Obra
              </h2>
              
              <form onSubmit={criarTarefa} className="flex gap-2 mb-6">
                <input
                  type="text"
                  className="flex-1 p-4 border border-gray-300 rounded-lg text-lg text-black outline-none focus:ring-2 focus:ring-orange-600 shadow-sm"
                  placeholder="Ex: Assentar piso da sala"
                  value={novaTarefa}
                  onChange={(e) => setNovaTarefa(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-slate-800 text-white font-bold px-6 py-4 rounded-lg text-lg hover:bg-slate-900 transition shadow-sm"
                >
                  Add
                </button>
              </form>

              {tarefas.length === 0 ? (
                <p className="text-center text-gray-600 text-lg">Nenhuma tarefa adicionada ainda.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {tarefas.map((tarefa) => (
                    <div 
                      key={tarefa.id} 
                      onClick={() => alternarConclusao(tarefa.id, tarefa.concluida)}
                      className={`p-6 rounded-xl shadow-sm border cursor-pointer flex items-center gap-4 transition ${
                        tarefa.concluida ? "bg-green-50 border-green-300" : "bg-white border-gray-200"
                      }`}
                    >
                      <div className={`min-w-8 h-8 rounded border-2 flex items-center justify-center transition-colors ${
                        tarefa.concluida ? "bg-green-500 border-green-500" : "bg-white border-gray-400"
                      }`}>
                        {tarefa.concluida && <span className="text-white font-bold text-xl">✓</span>}
                      </div>
                      
                      <span className={`text-xl font-bold transition-all ${tarefa.concluida ? "text-green-800 line-through opacity-70" : "text-gray-800"}`}>
                        {tarefa.nome}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </main>
  );
}