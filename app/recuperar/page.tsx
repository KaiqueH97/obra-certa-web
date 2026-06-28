"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);

    const toastId = toast.loading("Enviando link de recuperação...");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (error) {
      toast.error("Erro ao enviar: " + error.message, { id: toastId });
      setCarregando(false); // Libera o botão novamente se der erro
    } else {
      toast.success("Link enviado com sucesso!", { id: toastId });
      setEnviado(true);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      {/* Componente para renderizar os Toasts */}
      <Toaster position="top-center" reverseOrder={false} />
      
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">Recuperar Acesso</h1>
        
        {!enviado ? (
          <form onSubmit={handleRecuperar} className="flex flex-col gap-4">
            <p className="text-gray-600 mb-2 text-center">
              Digite seu e-mail para receber o link de recuperação.
            </p>
            <input
              type="email"
              placeholder="Seu e-mail"
              className="p-4 border rounded-lg text-black outline-none focus:ring-2 focus:ring-orange-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={carregando}
            />
            <button 
              type="submit" 
              disabled={carregando}
              className="bg-slate-800 text-white font-bold p-4 rounded-lg hover:bg-slate-900 transition disabled:opacity-50"
            >
              {carregando ? "Enviando..." : "Enviar Link"}
            </button>
          </form>
        ) : (
          <div className="text-center bg-green-50 p-6 rounded-xl border border-green-200 animate-fade-in">
            <p className="text-green-700 font-bold mb-2 text-xl">Link enviado com sucesso!</p>
            <p className="text-green-900 text-sm">
              Verifique sua caixa de entrada (e a pasta de spam) e siga as instruções para redefinir sua senha.
            </p>
          </div>
        )}
        
        <div className="mt-6 text-center border-t border-gray-100 pt-6">
          <Link href="/" className="text-orange-600 font-bold hover:underline transition">
            Voltar para o Login
          </Link>
        </div>
      </div>
    </main>
  );
}