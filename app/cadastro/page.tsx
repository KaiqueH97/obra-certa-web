"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Cadastro() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);

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
      alert("Erro ao cadastrar: " + error.message);
    } else {
      alert("Cadastro realizado! Verifique seu e-mail para confirmar.");
      router.push("/");
    }
    setCarregando(false);
  };

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg">
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
            className="bg-orange-600 text-white font-bold p-4 rounded-lg hover:bg-orange-700 transition"
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