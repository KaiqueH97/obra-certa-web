"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Link from "next/link";

export default function Perfil() {
  const router = useRouter();
  const [nome, setNome] = useState<string | null>("Carregando...");
  const [email, setEmail] = useState<string | null>("...");  
  const [telefone, setTelefone] = useState<string | null>(""); 
  const [novoTelefone, setNovoTelefone] = useState("");
  const [editando, setEditando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const carregarUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? "E-mail não encontrado");
        
        const nomeAtual = user.user_metadata?.nome || "Usuário";
        const telefoneAtual = user.user_metadata?.telefone || ""; // Puxa do banco
        
        setNome(nomeAtual);
        setNovoNome(nomeAtual);
        setTelefone(telefoneAtual);
        setNovoTelefone(telefoneAtual);
      }
    };
    
    carregarUsuario();
  }, []);

  const handleSalvarDados = async () => {
    if (!novoNome.trim()) {
      alert("O nome não pode ficar vazio.");
      return;
    }

    setSalvando(true);

    const { error } = await supabase.auth.updateUser({
      data: { 
        nome: novoNome,
        telefone: novoTelefone
      }
    });

    if (error) {
      alert("Erro ao atualizar os dados: " + error.message);
    } else {
      setNome(novoNome);
      setTelefone(novoTelefone);
      setEditando(false);
    }
    
    setSalvando(false);
  };

  const handleSair = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-md mt-4 animate-fade-in">
        
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Meu Perfil</h1>
          <Link href="/home" className="text-orange-600 font-bold text-lg hover:underline">
            Voltar
          </Link>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 flex flex-col gap-6 items-center">
          
          <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center border-4 border-slate-300">
            <span className="text-5xl">👷</span>
          </div>

          <div className="text-center w-full flex flex-col items-center">
            
            {!editando ? (
              <div className="flex flex-col items-center gap-2 mb-2">
                <h2 className="text-3xl font-black text-gray-900 truncate max-w-xs">
                  {nome}
                </h2>
                
                {/* NOVO: Exibe o telefone se ele existir */}
                {telefone && (
                  <p className="text-gray-700 font-bold text-lg mb-2 flex items-center gap-2">
                    📞 {telefone}
                  </p>
                )}

                <button 
                  onClick={() => setEditando(true)}
                  className="text-sm font-bold text-orange-600 bg-orange-50 px-4 py-1 rounded-full hover:bg-orange-100 transition mt-1"
                >
                  Editar Dados
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 w-full mb-2">
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg text-center text-lg font-bold text-gray-900 focus:ring-2 focus:ring-orange-600 outline-none"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Digite seu nome"
                />
                
                {/* NOVO: Input para o Telefone */}
                <input
                  type="tel"
                  className="w-full p-3 border border-gray-300 rounded-lg text-center text-lg font-bold text-gray-900 focus:ring-2 focus:ring-orange-600 outline-none"
                  value={novoTelefone}
                  onChange={(e) => setNovoTelefone(e.target.value)}
                  placeholder="WhatsApp: (11) 90000-0000"
                />

                <div className="flex gap-2 w-full mt-2">
                  <button 
                    onClick={() => {
                      setEditando(false);
                      setNovoNome(nome || "");
                      setNovoTelefone(telefone || "");
                    }}
                    className="flex-1 bg-gray-200 text-gray-800 font-bold py-2 rounded-lg hover:bg-gray-300 transition"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSalvarDados}
                    disabled={salvando}
                    className="flex-1 bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {salvando ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            )}

            <p className="text-gray-500 font-bold text-sm bg-gray-50 px-4 py-2 rounded-lg border border-gray-100 w-full mt-4">
              {email}
            </p>
          </div>

          <button
            onClick={handleSair}
            className="w-full bg-red-600 text-white font-bold p-4 rounded-lg text-xl hover:bg-red-700 transition mt-2 shadow-sm"
          >
            Sair do Sistema
          </button>
          
        </div>
      </div>
    </main>
  );
}