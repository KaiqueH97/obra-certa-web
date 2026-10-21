"use client";

import { useLocale } from "@/app/hooks/useLocale";
import { privateText, privateMessage, type PrivateMessageKey } from "@/lib/private-i18n";

export function usePrivateLocale() {
  const { locale } = useLocale();
  return {
    locale,
    p: (key: PrivateMessageKey, values?: Record<string, string | number>) => privateText(locale, key, values),
    message: (text: string) => privateMessage(locale, text),
  };
}
