"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { createPasswordReset, type PasswordResetState } from "@/lib/password-reset";

export default function RedefinirSenha() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [state, setState] = useState<PasswordResetState>({ status: "checking", email: null, error: null });
  const [reset] = useState(() => createPasswordReset({
    initialize: () => supabase.auth.initialize(),
    hasPendingCallback: () => {
      const { search, hash } = window.location;
      const params = [new window.URLSearchParams(search), new window.URLSearchParams(hash.slice(1))];
      // Após a inicialização, códigos/tokens restantes não foram consumidos pelo SDK.
      return params.some(part => ["code", "access_token", "refresh_token", "error", "error_code", "error_description"].some(key => part.has(key)));
    },
    getUser: () => supabase.auth.getUser(),
    updatePassword: password => supabase.auth.updateUser({ password }),
    clearPasswords: () => { setNovaSenha(""); setConfirmarSenha(""); },
    onState: setState,
  }));
  const feedback = useRef<HTMLDivElement>(null);
  const saving = state.status === "saving";
  const terminal = state.status === "invalid" || state.status === "uncertain" || state.status === "success";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Callback síncrono: não aguarda outras operações do Auth dentro da notificação.
      if (event !== "INITIAL_SESSION") reset.sessionChanged(session?.user.id ?? null);
    });
    void reset.activate();
    return () => { reset.deactivate(); subscription.unsubscribe(); };
  }, [reset]);

  useEffect(() => {
    if (terminal) feedback.current?.focus();
  }, [terminal, state.status]);

  const handleRedefinir = async (event: React.FormEvent) => {
    event.preventDefault();
    await reset.submit(novaSenha, confirmarSenha);
  };

  return <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
    <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
      <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">Nova senha</h1>

      {state.status === "checking" ? <p role="status" className="text-zinc-700">Validando seu acesso...</p> : terminal ? (
        <div ref={feedback} tabIndex={-1} role={state.status === "success" ? "status" : "alert"}
          className="rounded-xl border border-zinc-300 bg-zinc-50 p-4 text-zinc-900">
          {state.status === "success" ? "Senha alterada com sucesso! Você já pode continuar usando o sistema." : state.error}
        </div>
      ) : (
        <form onSubmit={handleRedefinir} aria-busy={saving} className="flex flex-col gap-4">
          <p className="text-zinc-700 wrap-break-word">Defina a nova senha para <strong>{state.email}</strong>.</p>
          <p id="senha-requisitos" className="text-sm text-zinc-700">Use pelo menos 6 caracteres. Sua conta pode exigir uma senha mais forte.</p>
          {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{state.error}</p>}
          {saving && <p role="status" className="text-zinc-700">Salvando nova senha...</p>}
          <label htmlFor="nova-senha" className="font-bold text-zinc-800">Nova senha</label>
          <input id="nova-senha" type="password" autoComplete="new-password" minLength={6} aria-describedby="senha-requisitos"
            className="w-full p-4 border border-zinc-300 rounded-lg text-black focus:ring-2 focus:ring-orange-600 outline-none disabled:bg-zinc-100"
            value={novaSenha} onChange={event => setNovaSenha(event.target.value)} required disabled={saving} />
          <label htmlFor="confirmar-senha" className="font-bold text-zinc-800">Confirmar senha</label>
          <input id="confirmar-senha" type="password" autoComplete="new-password" minLength={6}
            className="w-full p-4 border border-zinc-300 rounded-lg text-black focus:ring-2 focus:ring-orange-600 outline-none disabled:bg-zinc-100"
            value={confirmarSenha} onChange={event => setConfirmarSenha(event.target.value)} required disabled={saving} />
          <button type="submit" disabled={saving}
            className="bg-orange-700 text-white font-bold p-4 rounded-lg hover:bg-orange-800 transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">
            {saving ? "Salvando..." : "Atualizar senha"}
          </button>
        </form>
      )}

      <div className="mt-6 border-t border-gray-100 pt-6 flex flex-col gap-4 text-center">
        {state.status === "success" && <a href="/home" className="text-orange-700 font-bold underline">Continuar para o painel</a>}
        {state.status !== "success" && <Link href="/recuperar" className="text-orange-700 font-bold underline">Solicitar novo link</Link>}
        <Link href="/login" className="text-zinc-700 font-bold underline">Voltar para o login</Link>
      </div>
    </div>
  </main>;
}
