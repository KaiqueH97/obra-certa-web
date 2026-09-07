"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createMutationRunner } from "@/lib/confirmed-mutation";

export function useConfirmedMutation() {
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [runner] = useState(() => createMutationRunner({
    loading: (message) => toast.loading(message),
    success: (message, id) => { toast.success(message, { id }); },
    error: (message, id) => { toast.error(message, { id }); },
  }, setPending));

  useEffect(() => {
    runner.activate();
    return () => runner.deactivate();
  }, [runner]);

  return {
    run: runner.run,
    isPending: (key: string) => pending.has(key),
    isBusy: pending.size > 0,
  };
}
