"use client";

import { createElement, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createMutationRunner } from "@/lib/confirmed-mutation";

import { getLocale } from "@/lib/locale-store";
import { privateMessage } from "@/lib/private-i18n";

// Lê o idioma ao emitir o aviso, sem recriar o runner durante uma gravação.
function notice(message: string) {
  const locale = getLocale();
  if (locale === "pt-BR") return message;
  const translated = privateMessage(locale, message);
  return createElement("span", { lang: translated.lang }, translated.text);
}

export function useConfirmedMutation() {
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [requiresReload, setRequiresReload] = useState(false);
  const [runner] = useState(() => createMutationRunner({
    loading: (message) => toast.loading(notice(message)),
    success: (message, id) => { toast.success(notice(message), { id }); },
    error: (message, id) => { toast.error(notice(message), { id }); },
    dismiss: id => { toast.dismiss(id); },
  }, setPending, () => setRequiresReload(true)));

  useEffect(() => {
    runner.activate();
    return () => runner.deactivate();
  }, [runner]);

  return {
    run: runner.run,
    requiresReload,
    isPending: (key: string) => pending.has(key),
    isBusy: pending.size > 0,
  };
}
