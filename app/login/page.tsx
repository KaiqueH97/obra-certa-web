"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

export default function Home() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !senha) {
      toast.error("Por favor, preencha e-mail e senha.");
      return;
    }

    setCarregando(true);
    const toastId = toast.loading("Conectando...");
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      toast.error("Erro ao entrar: " + error.message, { id: toastId });
      setCarregando(false); // Só libera a tela se der erro
    } else {
      toast.success("Login realizado com sucesso!", { id: toastId });
      router.push("/home");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      {/* Componente para renderizar os Toasts */}
      <Toaster position="top-center" reverseOrder={false} />

      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg border border-gray-200 animate-fade-in">
        <h1 className="text-4xl font-black text-center text-orange-600 mb-8">Obra Certa</h1>

        {/* Mudamos para onSubmit na tag form para habilitar o "Enter" do teclado */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-gray-800 text-lg font-bold mb-2">E-mail</label>
            <input
              type="email"
              className="w-full p-4 border border-gray-300 rounded-lg text-lg text-black focus:ring-2 focus:ring-orange-600 outline-none disabled:bg-gray-100 disabled:text-gray-400 transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Digite seu e-mail"
              required
              disabled={carregando}
            />
          </div>

          <div>
            <label className="block text-gray-800 text-lg font-bold mb-2">Senha</label>
            <input
              type="password"
              className="w-full p-4 border border-gray-300 rounded-lg text-lg text-black focus:ring-2 focus:ring-orange-600 outline-none disabled:bg-gray-100 disabled:text-gray-400 transition"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Sua senha secreta"
              required
              disabled={carregando}
            />
          </div>

          {/* Entrar */}
          <div className="mt-8">
            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-orange-600 text-white font-bold p-4 rounded-lg text-xl hover:bg-orange-700 transition disabled:opacity-50"
            >
              {carregando ? "Conectando..." : "Entrar"}
            </button>
          </div>

          {/* Links para recuperação de senha e cadastro */}
          <div className="mt-6 flex flex-col gap-3 text-center border-t border-gray-100 pt-6">
            <Link href="/recuperar-senha" className="text-gray-500 font-medium hover:text-orange-600 transition">
              Esqueceu sua senha?
            </Link>
            <p className="text-gray-600">
              Não tem uma conta?{" "}
              <Link href="/cadastro" className="text-orange-600 font-bold hover:underline">
                Cadastre-se aqui
              </Link>
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}