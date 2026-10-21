"use client";

import Link from "next/link";
import { useLocale } from "@/app/hooks/useLocale";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";

export default function NotFound() {
  const { locale, t } = useLocale();
  return <main lang={locale} className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-6 text-center text-zinc-900">
    <p className="text-4xl font-black">404</p>
    <h1 className="text-2xl font-bold">{t("notFoundTitle")}</h1>
    <p>{t("notFoundDescription")}</p>
    <Link href="/" className="rounded-lg bg-zinc-900 px-5 py-3 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2">{t("backHome")}</Link>
    <LanguageSwitcher />
  </main>;
}
