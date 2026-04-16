"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function Home() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagem("Conectando...");
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setMensagem("Erro ao entrar: " + error.message);
    } else {
      setMensagem("Login realizado com sucesso!");
      router.push("/home");
    }
  };

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensagem("Criando sua conta...");
    
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
    });

    if (error) {
      setMensagem("Erro ao cadastrar: " + error.message);
    } else {
      setMensagem("Conta criada! Você já pode fazer o login.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md border border-gray-200">
        <h1 className="text-4xl font-bold text-center text-orange-600 mb-8">Obra Certa</h1>

        <form className="space-y-6">
          <div>
            <label className="block text-gray-800 text-lg font-bold mb-2">E-mail</label>
            <input
              type="email"
              className="w-full p-4 border border-gray-300 rounded-lg text-lg text-black focus:ring-2 focus:ring-orange-600 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Digite seu e-mail"
              required
            />
          </div>

          <div>
            <label className="block text-gray-800 text-lg font-bold mb-2">Senha</label>
            <input
              type="password"
              className="w-full p-4 border border-gray-300 rounded-lg text-lg text-black focus:ring-2 focus:ring-orange-600 outline-none"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Sua senha secreta"
              required
            />
          </div>

          <div className="flex flex-col gap-4 mt-8">
            <button
              onClick={handleLogin}
              className="w-full bg-orange-600 text-white font-bold p-4 rounded-lg text-xl hover:bg-orange-700 transition"
            >
              Entrar
            </button>
            <button
              onClick={handleCadastro}
              className="w-full bg-slate-800 text-white font-bold p-4 rounded-lg text-xl hover:bg-slate-900 transition"
            >
              Criar Nova Conta
            </button>
          </div>

          {mensagem && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-center font-bold text-blue-800">{mensagem}</p>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}