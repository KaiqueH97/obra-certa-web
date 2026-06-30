"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase"; 
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

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
  
  // NOVO ESTADO: Controla qual projeto está aguardando confirmação de exclusão
  const [projetoConfirmarExclusao, setProjetoConfirmarExclusao] = useState<number | null>(null);

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
    const toastId = toast.loading("Criando obra...");

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase.from("projetos").insert([
        { titulo: novoProjeto, user_id: user.id }
      ]);

      if (!error) {
        setNovoProjeto(""); 
        toast.success("Obra criada com sucesso!", { id: toastId });
        
        const { data } = await supabase
          .from("projetos")
          .select("*")
          .order("criado_em", { ascending: false });
        if (data) setProjetos(data);
      } else {
        toast.error("Erro ao criar obra: " + error.message, { id: toastId });
      }
      setCarregando(false);
    }
  };

  const iniciarEdicao = (projeto: Projeto) => {
    setProjetoEditando(projeto.id);
    setTituloEditado(projeto.titulo);
    setProjetoConfirmarExclusao(null); // Fecha a confirmação de exclusão se estiver aberta
  };

  const salvarEdicao = async (id: number) => {
    if (!tituloEditado.trim()) {
      toast.error("O nome da obra não pode ficar vazio.");
      return;
    }

    setCarregando(true);
    const toastId = toast.loading("Salvando alterações...");

    const { error } = await supabase
      .from("projetos")
      .update({ titulo: tituloEditado })
      .eq("id", id);

    if (!error) {
      setProjetos(projetos.map(p => p.id === id ? { ...p, titulo: tituloEditado } : p));
      setProjetoEditando(null); 
      toast.success("Nome atualizado!", { id: toastId });
    } else {
      toast.error("Erro ao editar obra: " + error.message, { id: toastId });
    }
    setCarregando(false);
  };

  const confirmarExclusaoProjeto = async (id: number) => {
    setCarregando(true);
    const toastId = toast.loading("Excluindo obra...");

    const { error } = await supabase
      .from("projetos")
      .delete()
      .eq("id", id);

    if (!error) {
      setProjetos(projetos.filter(p => p.id !== id));
      toast.success("Obra excluída com sucesso!", { id: toastId });
    } else {
      toast.error("Erro ao excluir obra: " + error.message, { id: toastId });
    }
    setProjetoConfirmarExclusao(null);
    setCarregando(false);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6 flex flex-col items-center pb-20">
      <Toaster position="top-center" reverseOrder={false} />
      
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
            className="flex-1 p-4 border border-gray-300 rounded-lg text-lg text-black outline-none focus:ring-2 focus:ring-orange-600 shadow-sm disabled:bg-gray-100"
            placeholder="Ex: Reforma da Cozinha"
            value={novoProjeto}
            onChange={(e) => setNovoProjeto(e.target.value)}
            disabled={carregando}
          />
          <button
            type="submit"
            disabled={carregando}
            className="bg-slate-800 text-white font-bold px-6 py-4 rounded-lg text-lg hover:bg-slate-900 transition shadow-sm disabled:opacity-50"
          >
            Criar
          </button>
        </form>

        {/* Lista de Projetos */}
        {carregando && projetos.length === 0 ? (
          <div className="flex justify-center p-6">
            <p className="text-center text-orange-600 font-bold text-lg animate-pulse">Carregando obras...</p>
          </div>
        ) : projetos.length === 0 ? (
          <p className="text-center text-gray-500 bg-white p-6 rounded-xl border border-gray-200">
            Você ainda não tem nenhuma obra cadastrada.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {projetos.map((projeto) => (
              <div 
                key={projeto.id} 
                className={`bg-white p-5 rounded-xl shadow-sm border transition-all ${
                  projetoConfirmarExclusao === projeto.id ? "border-red-400 ring-2 ring-red-100" : "border-gray-200 hover:shadow-md"
                } flex flex-col gap-3`}
              >
                {projetoEditando === projeto.id ? (
                  /* MODO EDIÇÃO */
                  <div className="flex flex-col gap-3 animate-fade-in">
                    <input
                      type="text"
                      className="w-full p-3 border border-orange-300 rounded-lg text-lg text-black outline-none focus:ring-2 focus:ring-orange-600 bg-orange-50 disabled:opacity-50"
                      value={tituloEditado}
                      onChange={(e) => setTituloEditado(e.target.value)}
                      disabled={carregando}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setProjetoEditando(null)}
                        disabled={carregando}
                        className="px-4 py-2 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={() => salvarEdicao(projeto.id)}
                        disabled={carregando}
                        className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition flex items-center gap-2"
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
                    
                    {/* Controle Dinâmico: Ações ou Confirmação de Exclusão */}
                    {projetoConfirmarExclusao === projeto.id ? (
                      <div className="mt-2 pt-3 border-t border-red-100 bg-red-50 p-3 rounded-lg flex flex-col items-center gap-2 animate-fade-in">
                        <p className="text-red-800 text-sm font-bold text-center">
                          Atenção: Todos os materiais e tarefas desta obra serão perdidos. Confirmar exclusão?
                        </p>
                        <div className="flex w-full gap-2 mt-1">
                          <button 
                            onClick={() => setProjetoConfirmarExclusao(null)}
                            disabled={carregando}
                            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => confirmarExclusaoProjeto(projeto.id)}
                            disabled={carregando}
                            className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition"
                          >
                            Sim, excluir
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-4 mt-2 pt-3 border-t border-gray-100">
                        <button 
                          onClick={() => iniciarEdicao(projeto)}
                          className="text-blue-600 font-bold text-sm hover:underline flex items-center gap-1"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => setProjetoConfirmarExclusao(projeto.id)}
                          className="text-red-600 font-bold text-sm hover:underline flex items-center gap-1"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
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