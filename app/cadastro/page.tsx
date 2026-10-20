"use client";

import { useLocale } from "@/app/hooks/useLocale";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";
import { translateAuthMessage } from "@/lib/i18n";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { createSignup, type SignupState } from "@/lib/signup";

export default function Cadastro() {
  const { locale, t } = useLocale();
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

  const errorMessage = translateAuthMessage(locale, state.error ?? "");

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    await signup.submit({ nome, email, password: senha });
  };

  return (
    <main lang={locale} className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg animate-fade-in">
        <div className="mb-6 flex justify-end text-zinc-900"><LanguageSwitcher /></div>
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">{t("createAccount")}</h1>
        {state.status === "email" ? <div ref={feedback} tabIndex={-1} role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
          <h2 className="font-bold">{t("checkEmail")}</h2>
          <p className="mt-2">{t("signupEmailHelp")}</p>
          <p className="mt-2">{t("signupExistingHelp")}</p>
        </div> : state.status === "uncertain" ? <div ref={feedback} tabIndex={-1} role="alert" className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-zinc-900">
          <span lang={errorMessage.lang}>{errorMessage.text}</span>
        </div> : <form onSubmit={handleCadastro} aria-busy={carregando} className="flex flex-col gap-4">
          {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800"><span lang={errorMessage.lang}>{errorMessage.text}</span></p>}
          {carregando && <p role="status" className="text-zinc-700">{state.status === "redirecting" ? t("openingApp") : t("creatingAccount")}</p>}
          {/* Nome */}
          <label htmlFor="cadastro-nome" className="font-bold text-zinc-800">{t("fullName")}</label>
          <input
            id="cadastro-nome" autoComplete="name" disabled={carregando}
            type="text"
            placeholder={t("fullNamePlaceholder")}
            className="p-4 border rounded-lg text-black outline-none focus:ring-2 focus:ring-orange-600"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
          <label htmlFor="cadastro-email" className="font-bold text-zinc-800">{t("email")}</label>
          <input
            id="cadastro-email" autoComplete="email" disabled={carregando}
            type="email"
            placeholder={t("yourEmail")}
            className="p-4 border rounded-lg text-black outline-none focus:ring-2 focus:ring-orange-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="cadastro-senha" className="font-bold text-zinc-800">{t("password")}</label>
          <input
            id="cadastro-senha" autoComplete="new-password" minLength={6} disabled={carregando}
            type="password"
            placeholder={t("yourPassword")}
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
            {carregando ? t("registering") : t("register")}
          </button>
        </form>}
        <p className="mt-6 text-center text-gray-600">
          {t("existingAccount")} <Link href="/login" className="text-orange-700 font-bold hover:underline">{t("signInLink")}</Link>
        </p>
        <p className="mt-3 text-center"><Link href="/recuperar" className="font-bold text-orange-700 hover:underline">{t("recoverAccess")}</Link></p>
      </div>
    </main>
  );
}
