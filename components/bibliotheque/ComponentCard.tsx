"use client";

import { useTransition } from "react";
import { toggleComponent, deleteComponent, type ComponentWithCount } from "@/actions/component.actions";
import { toast } from "@/lib/stores/toastStore";
import { COMPONENT_CATEGORY_LABELS } from "@/lib/labels";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { IconButton } from "@/components/ui/IconButton";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { CreateComponentModal } from "./CreateComponentModal";

export function ComponentCard({
  component,
  bikeTypes,
  isAdmin,
}: {
  component: ComponentWithCount;
  bikeTypes: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleComponent(component.id);
      if (!result.ok) return toast.error(result.error);
      toast.success(result.data.isActive ? "Composant activé." : "Composant désactivé.");
    });
  }

  return (
    <div className={`flex flex-col rounded-lg border border-gray-200 bg-white p-5 ${!component.isActive ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{component.name}</h3>
        <span className="flex-shrink-0 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
          {COMPONENT_CATEGORY_LABELS[component.category]}
        </span>
      </div>

      {!component.isActive && (
        <span className="mt-1 w-fit rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">Désactivé</span>
      )}

      {(component.brand || component.model) && (
        <p className="mt-2 text-sm text-gray-600">
          {[component.brand, component.model].filter(Boolean).join(" — ")}
        </p>
      )}
      {component.notes && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{component.notes}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {component.bikeTypes.length === 0 ? (
          <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-medium text-accent-700">
            Universel
          </span>
        ) : (
          component.bikeTypes.map((bt) => (
            <span key={bt.id} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
              {bt.name}
            </span>
          ))
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-400">
          Utilisé {component._count.studies} fois
        </span>
        {isAdmin && (
          <div className="flex items-center gap-1">
            <CreateComponentModal component={component} bikeTypes={bikeTypes} />
            <IconButton
              icon={component.isActive ? <EyeOffIcon /> : <EyeIcon />}
              label={component.isActive ? "Désactiver" : "Activer"}
              onClick={handleToggle}
              disabled={pending}
            />
            <DeleteButton
              onConfirm={() => deleteComponent(component.id)}
              successMessage="Composant supprimé."
              warning={
                component._count.studies > 0
                  ? `Retiré de ${component._count.studies} étude(s).`
                  : undefined
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
