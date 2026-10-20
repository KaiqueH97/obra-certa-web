"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, translate, type Locale, type MessageKey } from "@/lib/i18n";
import { getLocale, setLocale, subscribeLocale } from "@/lib/locale-store";

const getServerLocale = (): Locale => DEFAULT_LOCALE;

export function useLocale() {
  // Primeiro render do cliente coincide com o HTML estático em português.
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getServerLocale);
  const t = useCallback((key: MessageKey) => translate(locale, key), [locale]);
  return { locale, setLocale, t };
}
