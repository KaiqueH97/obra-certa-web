import { DEFAULT_LOCALE, isLocale, type Locale } from "./i18n";

export const LOCALE_STORAGE_KEY = "obra-certa:locale";
const CHANGE_EVENT = "obra-certa:locale-change";
let sessionLocale: Locale | undefined;

export function getLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  if (sessionLocale) return sessionLocale;
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(saved) ? saved : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function setLocale(locale: Locale) {
  if (typeof window === "undefined" || !isLocale(locale)) return;
  sessionLocale = locale;
  try { window.localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch {
    // A troca funciona nesta aba mesmo quando o navegador bloqueia persistência.
  }
  window.dispatchEvent(new window.Event(CHANGE_EVENT));
}

export function subscribeLocale(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== LOCALE_STORAGE_KEY) return;
    sessionLocale = undefined;
    listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
