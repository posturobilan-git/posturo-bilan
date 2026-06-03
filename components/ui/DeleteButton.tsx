"use client";

import { useState, useTransition } from "react";
import { toast } from "@/lib/stores/toastStore";
import { IconButton } from "@/components/ui/IconButton";
import { TrashIcon, CheckIcon, XIcon } from "@/components/ui/icons";
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
      <IconButton
        icon={<TrashIcon />}
        label="Supprimer"
        variant="danger"
        onClick={() => setConfirming(true)}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      {warning && <span className="mr-1 text-xs text-content-subtle">{warning}</span>}
      <IconButton
        icon={<CheckIcon />}
        label={pending ? "Suppression…" : "Confirmer la suppression"}
        variant="danger"
        active
        disabled={pending}
        onClick={handleDelete}
      />
      <IconButton
        icon={<XIcon />}
        label="Annuler"
        variant="neutral"
        disabled={pending}
        onClick={() => setConfirming(false)}
      />
    </span>
  );
}
