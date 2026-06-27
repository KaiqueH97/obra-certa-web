"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

export default function Cadastro() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    const toastId = toast.loading("Criando sua conta...");

    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          nome: nome,
        }
      }
    });

    if (error) {
      toast.error("Erro ao cadastrar: " + error.message, { id: toastId });
    } else {
      toast.success("Cadastro realizado! Verifique seu e-mail.", { id: toastId });
      router.push("/");
    }
    setCarregando(false);
  };

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      {/* Componente necessário para renderizar os Toasts nesta tela */}
      <Toaster position="top-center" reverseOrder={false} />
      
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">Criar Conta</h1>
        <form onSubmit={handleCadastro} className="flex flex-col gap-4">
          {/* Nome */}
          <input
            type="text"
            placeholder="Seu nome completo"
            className="p-4 border rounded-lg text-black outline-none focus:ring-2 focus:ring-orange-600"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Seu e-mail"
            className="p-4 border rounded-lg text-black outline-none focus:ring-2 focus:ring-orange-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Sua senha"
            className="p-4 border rounded-lg text-black outline-none focus:ring-2 focus:ring-orange-600"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={carregando}
            className="bg-orange-600 text-white font-bold p-4 rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
          >
            {carregando ? "Cadastrando..." : "Cadastrar"}
          </button>
        </form>
        <p className="mt-6 text-center text-gray-600">
          Já tem uma conta? <Link href="/" className="text-orange-600 font-bold hover:underline">Faça Login</Link>
        </p>
      </div>
    </main>
  );
}