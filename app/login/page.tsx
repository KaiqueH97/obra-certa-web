"use client";

import { useEffect, useState } from "react";
import { useAuthActions } from "@/app/components/AuthActionsProvider";
import Link from "next/link";
import { useLocale } from "@/app/hooks/useLocale";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";
import toast from "react-hot-toast";

export default function Home() {
  const { locale, t } = useLocale();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const { login, pending } = useAuthActions();
  const carregando = pending !== null;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("saida") === "parcial") {
      toast.error(<span lang={locale}>{t("partialLogout")}</span>, {
        id: "logout-parcial", duration: 10000,
      });
    }
  }, [locale, t]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !senha) {
      toast.error(<span lang={locale}>{t("requiredCredentials")}</span>);
      return;
    }

    await login({ email: email.trim(), password: senha });
  };

  return (
    <main lang={locale} className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg border border-gray-200 animate-fade-in">
        <div className="mb-6 flex justify-end text-zinc-900"><LanguageSwitcher /></div>
        <h1 className="text-4xl font-black text-center text-orange-600 mb-8">Obra Certa</h1>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="login-email" className="block text-gray-800 text-lg font-bold mb-2">{t("email")}</label>
            <input
              id="login-email" type="email" autoComplete="email"
              className="w-full p-4 border border-gray-300 rounded-lg text-lg text-black focus:ring-2 focus:ring-orange-600 outline-none disabled:bg-gray-100 disabled:text-gray-400 transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              required
              disabled={carregando}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-gray-800 text-lg font-bold mb-2">{t("password")}</label>
            <input
              id="login-password" type="password" autoComplete="current-password"
              className="w-full p-4 border border-gray-300 rounded-lg text-lg text-black focus:ring-2 focus:ring-orange-600 outline-none disabled:bg-gray-100 disabled:text-gray-400 transition"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={t("passwordPlaceholder")}
              required
              disabled={carregando}
            />
          </div>

          <div className="mt-8">
            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-orange-600 text-white font-bold p-4 rounded-lg text-xl hover:bg-orange-700 transition disabled:opacity-50"
            >
              {carregando ? t("connecting") : t("login")}
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-3 text-center border-t border-gray-100 pt-6">
            <Link href="/recuperar" className="text-gray-500 font-medium hover:text-orange-600 transition">
              {t("forgotPassword")}
            </Link>
            <p className="text-gray-600">
              {t("noAccount")}{" "}
              <Link href="/cadastro" className="text-orange-600 font-bold hover:underline">
                {t("signup")}
              </Link>
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
