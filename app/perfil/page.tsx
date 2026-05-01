"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Link from "next/link";

export default function Perfil() {
  const router = useRouter();
  const [nome, setNome] = useState<string | null>("Carregando..."); 
  const [email, setEmail] = useState<string | null>("...");

  useEffect(() => {
    const carregarUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? "E-mail não encontrado");
        setNome(user.user_metadata?.nome || "Usuário"); 
      }
    };
    
    carregarUsuario();
  }, []);

  // Logout
  const handleSair = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-md mt-4">
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Meu Perfil</h1>
          <Link href="/home" className="text-orange-600 font-bold text-lg hover:underline">
            Voltar
          </Link>
        </div>

        {/* Card do Perfil */}
        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 flex flex-col gap-8 items-center">
          
          {/* Avatar Simples */}
          <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center border-4 border-slate-300">
            <span className="text-5xl">👷</span>
          </div>

          {/* Informações: Nome em destaque e E-mail menor */}
          <div className="text-center w-full">
            <h2 className="text-3xl font-black text-gray-900 mb-1 truncate">
              {nome}
            </h2>
            <p className="text-gray-500 font-bold text-sm">
              {email}
            </p>
          </div>

          {/* Botão Gigante de Sair */}
          <button
            onClick={handleSair}
            className="w-full bg-red-600 text-white font-bold p-5 rounded-lg text-2xl hover:bg-red-700 transition mt-4 shadow-sm"
          >
            Sair do Sistema
          </button>
          
        </div>
      </div>
    </main>
  );
}