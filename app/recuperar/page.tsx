"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (error) {
      alert("Erro: " + error.message);
    } else {
      setEnviado(true);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">Recuperar Acesso</h1>
        {!enviado ? (
          <form onSubmit={handleRecuperar} className="flex flex-col gap-4">
            <p className="text-gray-600 mb-2">Digite seu e-mail para receber o link de recuperação.</p>
            <input
              type="email"
              placeholder="Seu e-mail"
              className="p-4 border rounded-lg text-black outline-none focus:ring-2 focus:ring-orange-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="bg-slate-800 text-white font-bold p-4 rounded-lg hover:bg-slate-900 transition">
              Enviar Link
            </button>
          </form>
        ) : (
          <div className="text-center">
            <p className="text-green-600 font-bold mb-4">Link enviado com sucesso!</p>
            <p className="text-gray-600">Verifique sua caixa de entrada.</p>
          </div>
        )}
        <div className="mt-6 text-center">
          <Link href="/" className="text-orange-600 font-bold hover:underline">Voltar para o Login</Link>
        </div>
      </div>
    </main>
  );
}