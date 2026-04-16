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

export default function TarefasDoProjeto() {
  const params = useParams();
  const projetoId = params.id; // Pega o ID que está na URL

  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [novaTarefa, setNovaTarefa] = useState("");
  const [carregando, setCarregando] = useState(true);

  const carregarTarefas = async () => {
    if (!projetoId) return;
    
    const { data, error } = await supabase
      .from("tarefas")
      .select("*")
      .eq("projeto_id", projetoId) 
      .order("criado_em", { ascending: true });

    if (!error && data) {
      setTarefas(data);
    }
    setCarregando(false);
  };

  useEffect(() => {
    carregarTarefas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId]);

  const criarTarefa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTarefa) return;

    setCarregando(true);
    const { error } = await supabase.from("tarefas").insert([
      { nome: novaTarefa, projeto_id: projetoId }
    ]);

    if (!error) {
      setNovaTarefa("");
      carregarTarefas();
    } else {
      alert("Erro ao adicionar tarefa: " + error.message);
      setCarregando(false);
    }
  };

  const alternarConclusao = async (id: number, statusAtual: boolean) => {
    const { error } = await supabase
      .from("tarefas")
      .update({ concluida: !statusAtual })
      .eq("id", id);

    if (!error) {
      carregarTarefas();
    } else {
      alert("Erro ao atualizar tarefa.");
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-md mt-4">
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Tarefas da Obra</h1>
          <Link href="/projetos" className="text-orange-600 font-bold text-lg hover:underline">
            Voltar
          </Link>
        </div>

        {/* Formulário para adicionar tarefa */}
        <form onSubmit={criarTarefa} className="flex gap-2 mb-8">
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

        {/* Lista de Tarefas */}
        {carregando ? (
          <p className="text-center text-gray-600 text-lg">Carregando tarefas...</p>
        ) : tarefas.length === 0 ? (
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
                {/* Checkbox visual gigante */}
                <div className={`w-8 h-8 rounded border-2 flex items-center justify-center ${
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
    </main>
  );
}