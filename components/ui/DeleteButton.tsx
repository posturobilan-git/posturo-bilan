"use client";

import { useState, useTransition } from "react";
import { toast } from "@/lib/stores/toastStore";
import type { ActionResult } from "@/lib/action-result";

interface Props {
  /** Server action invocation; returns an ActionResult. */
  onConfirm: () => Promise<ActionResult<unknown>>;
  /** Toast shown on success. */
  successMessage: string;
  /** Optional extra line shown in the confirm step (e.g. impact warning). */
  warning?: string;
}

/**
 * Two-step inline delete control: first click reveals a confirm/cancel pair,
 * avoiding a full modal for the lightweight library cards.
 */
export function DeleteButton({ onConfirm, successMessage, warning }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await onConfirm();
      if (!result.ok) {
        toast.error(result.error);
        setConfirming(false);
        return;
      }
      toast.success(successMessage);
      // Component unmounts on success (row disappears); no state reset needed.
    });
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-danger-600 transition-colors hover:text-danger-700"
      >
        Supprimer
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {warning && <span className="text-xs text-content-subtle">{warning}</span>}
      <button
        onClick={handleDelete}
        disabled={pending}
        className="text-sm font-medium text-danger-600 transition-colors hover:text-danger-700 disabled:opacity-50"
      >
        {pending ? "Suppression…" : "Confirmer"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="text-sm font-medium text-content-muted transition-colors hover:text-content disabled:opacity-50"
      >
        Annuler
      </button>
    </span>
  );
}
