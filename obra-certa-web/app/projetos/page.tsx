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
    if (!novoProjeto) return;

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

  return (
    <main className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-md mt-4">
        
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Meus Projetos</h1>
          <Link href="/home" className="text-orange-600 font-bold text-lg hover:underline">
            Voltar
          </Link>
        </div>

        <form onSubmit={criarProjeto} className="flex gap-2 mb-8">
          <input
            type="text"
            className="flex-1 p-4 border border-gray-300 rounded-lg text-lg text-black outline-none focus:ring-2 focus:ring-orange-600"
            placeholder="Ex: Reforma da Cozinha"
            value={novoProjeto}
            onChange={(e) => setNovoProjeto(e.target.value)}
          />
          <button
            type="submit"
            className="bg-slate-800 text-white font-bold px-6 py-4 rounded-lg text-lg hover:bg-slate-900 transition"
          >
            Criar
          </button>
        </form>

        {carregando ? (
          <p className="text-center text-gray-600 text-lg">Carregando obras...</p>
        ) : projetos.length === 0 ? (
          <p className="text-center text-gray-600 text-lg">Você ainda não tem nenhum projeto.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {projetos.map((projeto) => (
              <div 
                key={projeto.id} 
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center"
              >
                <span className="text-xl font-bold text-gray-800">{projeto.titulo}</span>
                <Link
                  href={`/projetos/${projeto.id}`}
                  className="text-orange-600 font-bold text-lg hover:underline"
                >
                  Abrir
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}