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
            {/* NOVO: PAINEL DE CUSTO TOTAL */}
            <div className="bg-green-800 text-white p-6 rounded-2xl shadow-md mb-8 flex flex-col items-center justify-center">
              <span className="text-green-200 text-sm font-bold uppercase tracking-wider mb-1">Custo Estimado da Obra</span>
              <span className="text-4xl font-black">
                R$ {custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* SEÇÃO 1: MATERIAIS */}
            <div className="mb-12">
              <div className="flex justify-between items-end mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  🛒 Materiais e Custos
                </h2>
              </div>

              {materiais.length === 0 ? (
                <p className="text-center text-gray-500 bg-white p-6 rounded-xl border border-gray-200">
                  Nenhum material salvo.
                </p>
              ) : (
                <ul className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
                  {materiais.map((item) => (
                    <li key={item.id} className="p-4 flex flex-col">
                      <div className="flex justify-between items-start mb-3">
                        <p className="font-bold text-gray-800">{item.nome}</p>
                        <span className="bg-yellow-100 text-yellow-800 py-1 px-3 rounded-full font-bold text-xs">
                          {item.quantidade}
                        </span>
                      </div>
                      
                      {/* NOVO: CAMPO DE ENTRADA DE PREÇO */}
                      <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <label className="text-sm font-semibold text-gray-600">Preço Total Pago (R$):</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={item.preco_total ? item.preco_total.toString().replace(".", ",") : ""}
                          placeholder="0,00"
                          // O evento onBlur dispara automaticamente quando o usuário clica fora do campo!
                          onBlur={(e) => atualizarPreco(item.id, e.target.value)}
                          className="w-24 p-2 text-right border border-gray-300 rounded font-bold text-green-700 outline-none focus:ring-2 focus:ring-green-500 bg-white"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              
              <Link 
                href="/calcular"
                className="mt-4 block w-full text-center bg-yellow-600 text-white font-bold p-3 rounded-lg hover:bg-yellow-700 transition shadow-sm"
              >
                + Fazer Novo Cálculo
              </Link>
            </div>

            <hr className="border-gray-300 mb-8" />

            {/* SEÇÃO 2: TAREFAS */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                📋 Tarefas da Obra
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