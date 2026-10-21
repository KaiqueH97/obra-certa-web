"use client";

import { useEffect } from "react";
import { useLocale } from "@/app/hooks/useLocale";

// O servidor e o primeiro render continuam em português. A preferência local
// só é aplicada depois da hidratação, sem remontar a árvore nem alterar URLs.
export function DocumentLocale() {
  const { locale, t } = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.querySelector('meta[name="description"]')?.setAttribute("content", t("appDescription"));
    document.querySelector('link[rel="manifest"]')?.setAttribute("href",
      locale === "en" ? "/manifest-en.json" : "/manifest.json");
  }, [locale, t]);
  return null;
}
