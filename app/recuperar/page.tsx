"use client";

import { useLocale } from "@/app/hooks/useLocale";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";
import { translateAuthMessage } from "@/lib/i18n";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createPasswordRecovery, type RecoveryState } from "@/lib/password-recovery";
import Link from "next/link";

export default function RecuperarSenha() {
  const { locale, t } = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<RecoveryState>({ status: "idle", error: null });
  const [recovery] = useState(() => createPasswordRecovery({
    request: address => supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    }),
    onState: setState,
  }));
  const feedback = useRef<HTMLDivElement>(null);
  const carregando = state.status === "sending";

  useEffect(() => {
    recovery.activate();
    return () => recovery.deactivate();
  }, [recovery]);

  useEffect(() => {
    if (state.status === "accepted" || state.status === "uncertain") feedback.current?.focus();
  }, [state.status]);

  const errorMessage = translateAuthMessage(locale, state.error ?? "");

  const handleRecuperar = async (event: React.FormEvent) => {
    event.preventDefault();
    await recovery.submit(email);
  };

  return <main lang={locale} className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
    <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg animate-fade-in">
      <div className="mb-6 flex justify-end text-zinc-900"><LanguageSwitcher /></div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">{t("recoveryTitle")}</h1>

      {state.status === "accepted" ? (
        <div ref={feedback} tabIndex={-1} role="status" className="rounded-xl border border-green-300 bg-green-50 p-6 text-green-950">
          <h2 className="text-xl font-bold mb-2">{t("checkEmail")}</h2>
          <p>{t("recoveryEmailHelp")}</p>
        </div>
      ) : state.status === "uncertain" ? (
        <div ref={feedback} tabIndex={-1} role="alert" className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-zinc-900"><span lang={errorMessage.lang}>{errorMessage.text}</span></div>
      ) : (
        <form onSubmit={handleRecuperar} aria-busy={carregando} className="flex flex-col gap-4">
          <p className="text-gray-700 text-center">{t("recoveryInstruction")}</p>
          {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800"><span lang={errorMessage.lang}>{errorMessage.text}</span></p>}
          {carregando && <p role="status" className="text-zinc-700">{t("requestingLink")}</p>}
          <label htmlFor="recuperar-email" className="font-bold text-zinc-800">{t("email")}</label>
          <input id="recuperar-email" type="email" autoComplete="email" placeholder={t("yourEmail")}
            className="p-4 border border-zinc-300 rounded-lg text-black outline-none focus:ring-2 focus:ring-orange-600 disabled:bg-zinc-100"
            value={email} onChange={event => setEmail(event.target.value)} required disabled={carregando} />
          <button type="submit" disabled={carregando}
            className="bg-slate-800 text-white font-bold p-4 rounded-lg hover:bg-slate-900 transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">
            {carregando ? t("requesting") : t("requestLink")}
          </button>
        </form>
      )}

      <div className="mt-6 text-center border-t border-gray-100 pt-6">
        <Link href="/login" className="text-orange-700 font-bold hover:underline transition">{t("backToLogin")}</Link>
      </div>
    </div>
  </main>;
}
