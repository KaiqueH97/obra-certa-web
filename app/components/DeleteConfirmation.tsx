"use client";

import { useEffect, useId, useRef } from "react";

type Props = {
  title: string;
  description: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

// Confirmação local: acompanha a visibilidade e o ciclo de vida da tela privada.
export function DeleteConfirmation({ title, description, pending, onCancel, onConfirm }: Props) {
  const id = useId();
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => { cancelButton.current?.focus(); }, []);

  return <div
    role="group"
    aria-labelledby={`${id}-title`}
    aria-describedby={`${id}-description`}
    aria-busy={pending}
    className="w-full rounded-xl border border-red-300 bg-red-50 p-4 text-zinc-900"
    onKeyDown={event => {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    }}
  >
    <p id={`${id}-title`} className="font-bold wrap-break-word">{title}</p>
    <p id={`${id}-description`} className="mt-1 text-sm text-zinc-700">{description}</p>
    <div className="mt-3 flex flex-wrap justify-end gap-2">
      <button ref={cancelButton} type="button" disabled={pending} onClick={onCancel}
        className="min-h-11 rounded-lg bg-zinc-200 px-4 py-2 font-bold text-zinc-900 hover:bg-zinc-300 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">
        Cancelar
      </button>
      <button type="button" disabled={pending} onClick={onConfirm}
        className="min-h-11 rounded-lg bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800">
        {pending ? "Removendo..." : "Confirmar exclusão"}
      </button>
    </div>
  </div>;
}
