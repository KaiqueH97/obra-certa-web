"use client";

import { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";

export function NetworkMonitor() {
  const [isOnline, setIsOnline] = useState(true);
  const hasMounted = useRef(false);

  useEffect(() => {
    // Funções de evento isoladas e limpas
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Conexão restabelecida! Seus dados já podem ser sincronizados.", {
        id: "network-status",
        duration: 4000,
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error("Você está offline. Algumas funções podem estar indisponíveis.", {
        id: "network-status",
        duration: Infinity,
        style: {
          background: '#ef4444',
          color: '#fff',
        }
      });
    };

    // No lugar de setar o estado de forma síncrona, apenas checamos
    // no momento da montagem (após o primeiro render) se o usuário JÁ LIGOU o app offline.
    if (typeof window !== "undefined" && !hasMounted.current) {
      hasMounted.current = true;
      if (!navigator.onLine) {
        handleOffline();
      }
    }

    // Apenas aguardamos os eventos do navegador acontecerem
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Cleanup: remove os listeners quando o componente for desmontado
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return null;
}