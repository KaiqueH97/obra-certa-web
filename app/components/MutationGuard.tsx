"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { UNCONFIRMED_MESSAGE } from "@/lib/confirmed-mutation";

export function MutationGuard({ blocked, children }: { blocked: boolean; children: ReactNode }) {
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => { if (blocked) feedback.current?.focus(); }, [blocked]);

  return <>
    {blocked && <div ref={feedback} tabIndex={-1} role="alert"
      className="mb-6 rounded-xl border border-orange-300 bg-orange-50 p-4 text-zinc-900">
      <p className="font-semibold">{UNCONFIRMED_MESSAGE}</p>
      <p className="mt-2">A edição está bloqueada nesta tela. Ao recarregar, alterações ainda não salvas nos formulários serão descartadas.</p>
      <button type="button" onClick={() => window.location.reload()}
        className="mt-3 rounded-lg bg-zinc-900 px-4 py-3 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">
        Recarregar dados
      </button>
    </div>}
    <fieldset disabled={blocked} className="contents">{children}</fieldset>
  </>;
}
