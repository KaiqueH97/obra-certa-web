"use client";

import { useId } from "react";
import { useLocale } from "@/app/hooks/useLocale";
import { isLocale } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  const id = useId();
  return <div lang={locale} className="flex flex-wrap items-center gap-2 text-sm">
    <label htmlFor={id} className="font-semibold">{t("language")}</label>
    <select id={id} value={locale} onChange={event => {
      if (isLocale(event.target.value)) setLocale(event.target.value);
    }} className="min-h-11 rounded-lg border border-zinc-400 bg-white px-3 py-2 text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">
      <option value="pt-BR" lang="pt-BR">Português</option>
      <option value="en" lang="en">English</option>
    </select>
  </div>;
}
