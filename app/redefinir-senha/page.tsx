"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function RedefinirSenha() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  const handleRedefinir = async (e: React.FormEvent) => {
    e.preventDefault();

    if (novaSenha !== confirmarSenha) {
      alert("As senhas não coincidem!");
      return;
    }

    if (novaSenha.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setCarregando(true);

    const { error } = await supabase.auth.updateUser({
      password: novaSenha,
    });

    if (error) {
      alert("Erro ao redefinir: " + error.message);
    } else {
      alert("Senha alterada com sucesso! Agora você pode fazer login.");
      router.push("/"); // Volta para o Login
    }
    setCarregando(false);
  };

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Nova Senha</h1>
        <p className="text-gray-600 mb-8 text-center text-sm">
          Digite e confirme sua nova senha de acesso.
        </p>

        <form onSubmit={handleRedefinir} className="flex flex-col gap-4">
          <div>
            <label className="block text-gray-800 font-bold mb-1">Nova Senha</label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              className="w-full p-4 border rounded-lg text-black focus:ring-2 focus:ring-orange-600 outline-none"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-gray-800 font-bold mb-1">Confirmar Senha</label>
            <input
              type="password"
              placeholder="Repita a nova senha"
              className="w-full p-4 border rounded-lg text-black focus:ring-2 focus:ring-orange-600 outline-none"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-orange-600 text-white font-bold p-4 rounded-lg text-xl hover:bg-orange-700 transition mt-4 disabled:opacity-50"
          >
            {carregando ? "Salvando..." : "Atualizar Senha"}
          </button>
        </form>
      </div>
    </main>
  );
}