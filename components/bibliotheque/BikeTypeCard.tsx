"use client";

import { useTransition } from "react";
import { toggleBikeType, deleteBikeType, type BikeTypeWithCount } from "@/actions/bikeType.actions";
import { toast } from "@/lib/stores/toastStore";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { CreateBikeTypeModal } from "./CreateBikeTypeModal";

export function BikeTypeCard({ bikeType, isAdmin }: { bikeType: BikeTypeWithCount; isAdmin: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleBikeType(bikeType.id);
      if (!result.ok) return toast.error(result.error);
      toast.success(result.data.isActive ? "Type de vélo activé." : "Type de vélo désactivé.");
    });
  }

  return (
    <div className={`flex flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${!bikeType.isActive ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-content">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="6" cy="17" r="3.5" strokeWidth={1.8} />
              <circle cx="18" cy="17" r="3.5" strokeWidth={1.8} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 17l4-7h5l3 7M10 10l-1.5-3H6.5M13 7h3.5" />
            </svg>
          </span>
          {bikeType.name}
        </h3>
        {!bikeType.isActive && (
          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-content-muted">Désactivé</span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-content-subtle">
          {bikeType._count.studies} étude{bikeType._count.studies !== 1 ? "s" : ""}
        </span>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <CreateBikeTypeModal bikeType={bikeType} />
            <button
              onClick={handleToggle}
              disabled={pending}
              className="text-sm font-medium text-content-muted transition-colors hover:text-content disabled:opacity-50"
            >
              {bikeType.isActive ? "Désactiver" : "Activer"}
            </button>
            <DeleteButton
              onConfirm={() => deleteBikeType(bikeType.id)}
              successMessage="Type de vélo supprimé."
              warning={
                bikeType._count.studies > 0
                  ? `${bikeType._count.studies} étude(s) — désactivez plutôt.`
                  : undefined
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
