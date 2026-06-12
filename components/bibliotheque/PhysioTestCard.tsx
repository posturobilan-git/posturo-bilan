"use client";

import { useTransition } from "react";
import { togglePhysioTest, deletePhysioTest, type PhysioTestWithTypes } from "@/actions/physioTest.actions";
import { toast } from "@/lib/stores/toastStore";
import { PHYSIO_OUTPUT_TYPE_LABELS } from "@/lib/labels";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { IconButton } from "@/components/ui/IconButton";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { CreatePhysioTestModal } from "./CreatePhysioTestModal";

export function PhysioTestCard({
  physioTest,
  bikeTypes,
  isAdmin,
}: {
  physioTest: PhysioTestWithTypes;
  bikeTypes: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await togglePhysioTest(physioTest.id);
      if (!result.ok) return toast.error(result.error);
      toast.success(result.data.isActive ? "Test activé." : "Test désactivé.");
    });
  }

  const typeLabel =
    physioTest.outputType === "VALUE" && physioTest.unit
      ? `Valeur (${physioTest.unit})`
      : PHYSIO_OUTPUT_TYPE_LABELS[physioTest.outputType];

  return (
    <div className={`flex flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${!physioTest.isActive ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-content">{physioTest.name}</h3>
          <p className="mt-0.5 text-xs text-content-subtle">{typeLabel}</p>
        </div>
        {!physioTest.isActive && (
          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-content-muted">Désactivé</span>
        )}
      </div>

      {physioTest.description && (
        <p className="mt-2 line-clamp-2 text-sm text-content-muted">{physioTest.description}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {physioTest.isCommon ? (
          <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-medium text-accent-700">
            Tronc commun
          </span>
        ) : physioTest.bikeTypes.length > 0 ? (
          physioTest.bikeTypes.map((bt) => (
            <span key={bt.id} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
              {bt.name}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-content-muted">
            Aucun type associé
          </span>
        )}
      </div>

      {isAdmin && (
        <div className="mt-4 flex items-center justify-end gap-1 border-t border-border pt-3">
          <CreatePhysioTestModal physioTest={physioTest} bikeTypes={bikeTypes} />
          <IconButton
            icon={physioTest.isActive ? <EyeOffIcon /> : <EyeIcon />}
            label={physioTest.isActive ? "Désactiver" : "Activer"}
            onClick={handleToggle}
            disabled={pending}
          />
          <DeleteButton
            onConfirm={() => deletePhysioTest(physioTest.id)}
            successMessage="Test physio supprimé."
          />
        </div>
      )}
    </div>
  );
}
