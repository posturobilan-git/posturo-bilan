"use client";

import { useTransition } from "react";
import { toggleMeasurement, type MeasurementWithTypes } from "@/actions/measurement.actions";
import { toast } from "@/lib/stores/toastStore";
import { MEASUREMENT_CATEGORY_LABELS } from "@/lib/labels";
import { CreateMeasurementModal } from "./CreateMeasurementModal";

export function MeasurementCard({
  measurement,
  bikeTypes,
  isAdmin,
}: {
  measurement: MeasurementWithTypes;
  bikeTypes: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleMeasurement(measurement.id);
      if (!result.ok) return toast.error(result.error);
      toast.success(result.data.isActive ? "Côte activée." : "Côte désactivée.");
    });
  }

  return (
    <div className={`flex flex-col rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${!measurement.isActive ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-content">
            {measurement.name}
            <span className="ml-1.5 text-sm font-normal text-content-subtle">({measurement.unit})</span>
          </h3>
          <p className="mt-0.5 text-xs text-content-subtle">
            {MEASUREMENT_CATEGORY_LABELS[measurement.category]} · ordre {measurement.order}
          </p>
        </div>
        {!measurement.isActive && (
          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-content-muted">Désactivé</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {measurement.isCommon ? (
          <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-medium text-accent-700">
            Tronc commun
          </span>
        ) : measurement.bikeTypes.length > 0 ? (
          measurement.bikeTypes.map((bt) => (
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
        <div className="mt-4 flex items-center justify-end gap-3 border-t border-border pt-3">
          <CreateMeasurementModal measurement={measurement} bikeTypes={bikeTypes} />
          <button
            onClick={handleToggle}
            disabled={pending}
            className="text-sm font-medium text-content-muted transition-colors hover:text-content disabled:opacity-50"
          >
            {measurement.isActive ? "Désactiver" : "Activer"}
          </button>
        </div>
      )}
    </div>
  );
}
