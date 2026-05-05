"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase"; 
import Link from "next/link";

interface Projeto {
  id: number;
  titulo: string;
  user_id: string;
  criado_em: string;
}

export default function Projetos() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [novoProjeto, setNovoProjeto] = useState("");
  const [carregando, setCarregando] = useState(true);

  const [projetoEditando, setProjetoEditando] = useState<number | null>(null);
  const [tituloEditado, setTituloEditado] = useState("");

  useEffect(() => {
    const buscarProjetos = async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("*")
        .order("criado_em", { ascending: false });

      if (!error && data) {
        setProjetos(data);
      }
      setCarregando(false);
    };

    buscarProjetos();
  }, []); 

  const criarProjeto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoProjeto.trim()) return;

    setCarregando(true); 
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase.from("projetos").insert([
        { titulo: novoProjeto, user_id: user.id }
      ]);

      if (!error) {
        setNovoProjeto(""); 
        const { data } = await supabase
          .from("projetos")
          .select("*")
          .order("criado_em", { ascending: false });
        if (data) setProjetos(data);
      } else {
        alert("Erro ao criar projeto: " + error.message);
      }
      setCarregando(false);
    }
  };

  const iniciarEdicao = (projeto: Projeto) => {
    setProjetoEditando(projeto.id);
    setTituloEditado(projeto.titulo);
  };

  const salvarEdicao = async (id: number) => {
    if (!tituloEditado.trim()) {
      alert("O nome da obra não pode ficar vazio.");
      return;
    }

    setCarregando(true);
    const { error } = await supabase
      .from("projetos")
      .update({ titulo: tituloEditado })
      .eq("id", id);

    if (!error) {
      setProjetos(projetos.map(p => p.id === id ? { ...p, titulo: tituloEditado } : p));
      setProjetoEditando(null); 
    } else {
      alert("Erro ao editar obra: " + error.message);
    }
    setCarregando(false);
  };

  // --- D (DELETE) ---
  const excluirProjeto = async (id: number) => {
    const confirmacao = window.confirm(
      "Tem certeza que deseja excluir esta obra? Todas as tarefas e materiais vinculados poderão ser apagados também."
    );
    
    if (!confirmacao) return;

    setCarregando(true);
    const { error } = await supabase
      .from("projetos")
      .delete()
      .eq("id", id);

    if (!error) {
      setProjetos(projetos.filter(p => p.id !== id));
    } else {
      alert("Erro ao excluir obra: " + error.message);
    }
    setCarregando(false);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6 flex flex-col items-center pb-20">
      <div className="w-full max-w-md mt-4 animate-fade-in">
        
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Meus Projetos</h1>
          <Link href="/home" className="text-orange-600 font-bold text-lg hover:underline">
            Voltar
          </Link>
        </div>

        {/* Formulário de Criação */}
        <form onSubmit={criarProjeto} className="flex gap-2 mb-8">
          <input
            type="text"
            className="flex-1 p-4 border border-gray-300 rounded-lg text-lg text-black outline-none focus:ring-2 focus:ring-orange-600 shadow-sm"
            placeholder="Ex: Reforma da Cozinha"
            value={novoProjeto}
            onChange={(e) => setNovoProjeto(e.target.value)}
          />
          <button
            type="submit"
            className="bg-slate-800 text-white font-bold px-6 py-4 rounded-lg text-lg hover:bg-slate-900 transition shadow-sm"
          >
            Criar
          </button>
        </form>

        {/* Lista de Projetos */}
        {carregando && projetos.length === 0 ? (
          <p className="text-center text-gray-600 text-lg">Carregando obras...</p>
        ) : projetos.length === 0 ? (
          <p className="text-center text-gray-500 bg-white p-6 rounded-xl border border-gray-200">
            Você ainda não tem nenhuma obra cadastrada.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {projetos.map((projeto) => (
              <div 
                key={projeto.id} 
                className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-3 transition-all hover:shadow-md"
              >
                {projetoEditando === projeto.id ? (
                  /* MODO EDIÇÃO */
                  <div className="flex flex-col gap-3">
                    <input
                      type="text"
                      className="w-full p-3 border border-orange-300 rounded-lg text-lg text-black outline-none focus:ring-2 focus:ring-orange-600 bg-orange-50"
                      value={tituloEditado}
                      onChange={(e) => setTituloEditado(e.target.value)}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setProjetoEditando(null)}
                        className="px-4 py-2 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={() => salvarEdicao(projeto.id)}
                        className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* MODO VISUALIZAÇÃO */
                  <>
                    <div className="flex justify-between items-start">
                      <span className="text-xl font-bold text-gray-800 wrap-break-word pr-2">
                        {projeto.titulo}
                      </span>
                      <Link
                        href={`/projetos/${projeto.id}`}
                        className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-orange-200 transition whitespace-nowrap"
                      >
                        Abrir Obra
                      </Link>
                    </div>
                    
                    {/* Botões de Ação (Editar e Excluir) */}
                    <div className="flex justify-end gap-4 mt-2 pt-3 border-t border-gray-100">
                      <button 
                        onClick={() => iniciarEdicao(projeto)}
                        className="text-blue-600 font-bold text-sm hover:underline flex items-center gap-1"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={() => excluirProjeto(projeto.id)}
                        className="text-red-600 font-bold text-sm hover:underline flex items-center gap-1"
                      >
                        Excluir
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}