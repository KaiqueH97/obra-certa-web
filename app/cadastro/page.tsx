"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { createSignup, type SignupState } from "@/lib/signup";

export default function Cadastro() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [state, setState] = useState<SignupState>({ status: "idle", error: null });
  const [signup] = useState(() => createSignup({
    request: input => supabase.auth.signUp({
      email: input.email, password: input.password, options: { data: { nome: input.nome } },
    }),
    onState: setState,
    clearPassword: () => setSenha(""),
    navigate: path => window.location.replace(path),
  }));
  const feedback = useRef<HTMLDivElement>(null);
  const carregando = state.status === "submitting" || state.status === "redirecting";

  useEffect(() => {
    signup.activate();
    return () => signup.deactivate();
  }, [signup]);

  useEffect(() => {
    if (state.status === "email" || state.status === "uncertain") feedback.current?.focus();
  }, [state.status]);

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    await signup.submit({ nome, email, password: senha });
  };

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">Criar Conta</h1>
        {state.status === "email" ? <div ref={feedback} tabIndex={-1} role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
          <h2 className="font-bold">Confira seu e-mail</h2>
          <p className="mt-2">Se o cadastro puder ser concluído com este e-mail, você receberá instruções para confirmar o acesso. Confira também a pasta de spam.</p>
          <p className="mt-2">Se já tem uma conta, entre ou recupere sua senha.</p>
        </div> : state.status === "uncertain" ? <div ref={feedback} tabIndex={-1} role="alert" className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-zinc-900">
          {state.error}
        </div> : <form onSubmit={handleCadastro} aria-busy={carregando} className="flex flex-col gap-4">
          {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{state.error}</p>}
          {carregando && <p role="status" className="text-zinc-700">{state.status === "redirecting" ? "Abrindo o sistema..." : "Criando sua conta..."}</p>}
          {/* Nome */}
          <label htmlFor="cadastro-nome" className="font-bold text-zinc-800">Nome completo</label>
          <input
            id="cadastro-nome" autoComplete="name" disabled={carregando}
            type="text"
            placeholder="Seu nome completo"
            className="p-4 border rounded-lg text-black outline-none focus:ring-2 focus:ring-orange-600"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
          <label htmlFor="cadastro-email" className="font-bold text-zinc-800">E-mail</label>
          <input
            id="cadastro-email" autoComplete="email" disabled={carregando}
            type="email"
            placeholder="Seu e-mail"
            className="p-4 border rounded-lg text-black outline-none focus:ring-2 focus:ring-orange-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="cadastro-senha" className="font-bold text-zinc-800">Senha</label>
          <input
            id="cadastro-senha" autoComplete="new-password" minLength={6} disabled={carregando}
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
        </form>}
        <p className="mt-6 text-center text-gray-600">
          Já tem uma conta? <Link href="/login" className="text-orange-700 font-bold hover:underline">Faça Login</Link>
        </p>
        <p className="mt-3 text-center"><Link href="/recuperar" className="font-bold text-orange-700 hover:underline">Recuperar acesso</Link></p>
      </div>
    </main>
  );
}
