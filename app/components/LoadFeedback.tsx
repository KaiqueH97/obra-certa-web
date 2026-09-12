"use client";

export function LoadFeedback({ error, retry }: { error: string | null; retry: () => void }) {
  if (!error) return <p role="status" className="p-6 text-center font-medium text-zinc-700">Carregando dados...</p>;
  return <div role="alert" className="m-4 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
    <p className="font-semibold">{error}</p>
    <button type="button" onClick={retry} className="mt-3 rounded-lg bg-zinc-900 px-4 py-3 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">
      Tentar novamente
    </button>
  </div>;
}
