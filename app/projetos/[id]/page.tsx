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
}

export default function DetalhesDoProjeto() {
  const params = useParams();
  const projetoId = params.id; 

  const [tituloObra, setTituloObra] = useState("Carregando Obra...");
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [novaTarefa, setNovaTarefa] = useState("");
  const [carregando, setCarregando] = useState(true);

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
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 truncate pr-2">{tituloObra}</h1>
          <Link href="/projetos" className="text-orange-600 font-bold text-lg hover:underline whitespace-nowrap">
            Voltar
          </Link>
        </div>

        {carregando ? (
          <p className="text-center text-gray-600 text-lg mt-10">Carregando dados da obra...</p>
        ) : (
          <>
            {/* ================= SEÇÃO 1: MATERIAIS ================= */}
            <div className="mb-12">
              <div className="flex justify-between items-end mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  🛒 Lista de Materiais
                </h2>
              </div>

              {materiais.length === 0 ? (
                <p className="text-center text-gray-500 bg-white p-6 rounded-xl border border-gray-200">
                  Nenhum material salvo.
                </p>
              ) : (
                <ul className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {materiais.map((item) => (
                    <li key={item.id} className="p-4 flex justify-between items-center">
                      <p className="font-bold text-gray-800">{item.nome}</p>
                      <span className="bg-yellow-100 text-yellow-800 py-1 px-3 rounded-full font-bold text-sm">
                        {item.quantidade}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              
              <Link 
                href="/calcular"
                className="mt-3 block w-full text-center bg-yellow-600 text-white font-bold p-3 rounded-lg hover:bg-yellow-700 transition"
              >
                + Fazer Novo Cálculo
              </Link>
            </div>

            <hr className="border-gray-300 mb-8" />

            {/* ================= SEÇÃO 2: TAREFAS (SEU CÓDIGO) ================= */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                📋 Tarefas da Obra
              </h2>
              
              <form onSubmit={criarTarefa} className="flex gap-2 mb-6">
                <input
                  type="text"
                  className="flex-1 p-4 border border-gray-300 rounded-lg text-lg text-black outline-none focus:ring-2 focus:ring-orange-600"
                  placeholder="Ex: Assentar piso da sala"
                  value={novaTarefa}
                  onChange={(e) => setNovaTarefa(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-slate-800 text-white font-bold px-6 py-4 rounded-lg text-lg hover:bg-slate-900 transition"
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
                      <div className={`min-w-[2rem] h-8 rounded border-2 flex items-center justify-center ${
                        tarefa.concluida ? "bg-green-500 border-green-500" : "bg-white border-gray-400"
                      }`}>
                        {tarefa.concluida && <span className="text-white font-bold text-xl">✓</span>}
                      </div>
                      
                      <span className={`text-xl font-bold ${tarefa.concluida ? "text-green-800 line-through opacity-70" : "text-gray-800"}`}>
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