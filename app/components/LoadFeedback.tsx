"use client";

import { usePrivateLocale } from "@/app/hooks/usePrivateLocale";

export function LoadFeedback({ error, retry }: { error: string | null; retry: () => void }) {
  const { locale, p, message } = usePrivateLocale();
  if (!error) return <p lang={locale} role="status" className="p-6 text-center font-medium text-zinc-700">{p("Carregando dados...")}</p>;
  return <div lang={locale} role="alert" className="m-4 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
    <p lang={message(error).lang} className="font-semibold">{message(error).text}</p>
    <button type="button" onClick={retry} className="mt-3 rounded-lg bg-zinc-900 px-4 py-3 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">
      {p("Tentar novamente")}
    </button>
  </div>;
}
