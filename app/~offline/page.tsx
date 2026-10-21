"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Recuperação offline usa navegação completa, sem reutilizar o cache do roteador. */

import { useLocale } from "@/app/hooks/useLocale";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  const { locale, t } = useLocale();
  return (
    <main lang={locale} className="flex min-h-screen flex-col items-center justify-center p-6 bg-zinc-50 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-100 flex flex-col items-center max-w-md w-full">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
          <WifiOff size={32} />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">
          {t("offlineTitle")}
        </h1>
        <p className="text-zinc-600 mb-8">
          {t("offlineDescription")}
        </p>
        <a
          href="/"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          {t("retryConnection")}
        </a>
        <div className="mt-6"><LanguageSwitcher /></div>
      </div>
    </main>
  );
}
