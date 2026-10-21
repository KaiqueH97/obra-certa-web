"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { translate } from "@/lib/i18n";
import { getLocale, subscribeLocale } from "@/lib/locale-store";

const NOTICE_ID = "network-status";

export function NetworkMonitor() {
  useEffect(() => {
    let online = window.navigator.onLine;
    const showOffline = () => {
      const locale = getLocale();
      toast.error(<span lang={locale}>{translate(locale, "networkOffline")}</span>, {
        id: NOTICE_ID, duration: Infinity,
        style: { background: "#b91c1c", color: "#fff" },
      });
    };
    const handleOffline = () => {
      if (!online) return;
      online = false;
      showOffline();
    };
    const handleOnline = () => {
      if (online) return;
      online = true;
      const locale = getLocale();
      toast.success(<span lang={locale}>{translate(locale, "networkOnline")}</span>, {
        id: NOTICE_ID, duration: 4000,
        style: { background: "#fff", color: "#111827" },
      });
    };
    if (!online) showOffline();
    // Atualiza o aviso persistente no mesmo ID; não simula mudança de conexão.
    const unsubscribe = subscribeLocale(() => { if (!online) showOffline(); });
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      toast.dismiss(NOTICE_ID);
    };
  }, []);
  return null;
}
