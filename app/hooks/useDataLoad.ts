"use client";

import { useCallback, useEffect, useState } from "react";
import { createDataLoader, type LoadState } from "@/lib/load-data";

// load e onLoaded devem ter identidade estável (funções externas ou useCallback).
export function useDataLoad<T>(load: (signal: AbortSignal) => Promise<T>, onLoaded: (data: T) => void) {
  const [state, setState] = useState<LoadState>({ status: "loading", error: null });
  const [loader] = useState(() => createDataLoader(setState));
  const retry = useCallback(() => loader.run(load, onLoaded), [loader, load, onLoaded]);

  useEffect(() => {
    loader.activate();
    void retry();
    return () => loader.cancel();
  }, [loader, retry]);

  return { loading: state.status === "loading", ready: state.status === "ready", error: state.error, retry };
}
