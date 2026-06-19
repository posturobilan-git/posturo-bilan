"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { PencilIcon } from "@/components/ui/icons";
import { createRiderMeasurement, updateRiderMeasurement } from "@/actions/riderMeasurement.actions";
import { toast } from "@/lib/stores/toastStore";
import { MEASUREMENT_CATEGORIES, MEASUREMENT_CATEGORY_LABELS } from "@/lib/labels";
import type { MeasurementCategory } from "@prisma/client";

interface BikeTypeOption {
  id: string;
  name: string;
}

interface RiderMeasurementValue {
  id: string;
  name: string;
  unit: string;
  category: MeasurementCategory;
  isCommon: boolean;
  isRequired: boolean;
  bikeTypes: { id: string; name: string }[];
}

export function CreateRiderMeasurementModal({
  measurement,
  bikeTypes,
}: {
  measurement?: RiderMeasurementValue;
  bikeTypes: BikeTypeOption[];
}) {
  const isEdit = Boolean(measurement);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [isCommon, setIsCommon] = useState(measurement?.isCommon ?? false);
  const [isRequired, setIsRequired] = useState(measurement?.isRequired ?? false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    measurement?.bikeTypes.map((b) => b.id) ?? []
  );

  function toggleType(id: string) {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function reset() {
    setError(null);
    setIsCommon(measurement?.isCommon ?? false);
    setIsRequired(measurement?.isRequired ?? false);
    setSelectedTypes(measurement?.bikeTypes.map((b) => b.id) ?? []);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      unit: String(fd.get("unit") ?? "").trim(),
      category: String(fd.get("category") ?? "POSITION") as MeasurementCategory,
      isCommon,
      isRequired,
      bikeTypeIds: isCommon ? [] : selectedTypes,
    };

    setError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateRiderMeasurement(measurement!.id, payload)
        : await createRiderMeasurement(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isEdit ? "Mesure modifiée." : "Mesure créée.");
      setOpen(false);
    });
  }

  return (
    <>
      {isEdit ? (
        <IconButton
          icon={<PencilIcon />}
          label="Modifier"
          variant="brand"
          onClick={() => { reset(); setOpen(true); }}
        />
      ) : (
        <Button className="w-full sm:w-auto" onClick={() => { reset(); setOpen(true); }}>+ Nouvelle mesure du cycliste</Button>
      )}

      {open && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-content">
                {isEdit ? "Modifier la mesure du cycliste" : "Nouvelle mesure du cycliste"}
              </h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-content-subtle hover:bg-surface-muted" aria-label="Fermer">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-content">Nom <span className="text-danger-500">*</span></span>
                <input name="name" required defaultValue={measurement?.name} placeholder="KOPS, angle du genou…"
                  className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-content">Unité <span className="text-danger-500">*</span></span>
                  <input name="unit" required defaultValue={measurement?.unit} placeholder="mm, cm, °"
                    className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-content">Catégorie</span>
                  <select name="category" defaultValue={measurement?.category ?? "POSITION"}
                    className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                    {MEASUREMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{MEASUREMENT_CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm font-medium text-content">Saisie obligatoire dans l&apos;étude</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isCommon}
                  onChange={(e) => setIsCommon(e.target.checked)}
                  className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm font-medium text-content">Tronc commun (s&apos;applique à tous les types de vélo)</span>
              </label>

              {!isCommon && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-content">Types de vélo concernés</span>
                  {bikeTypes.length === 0 ? (
                    <p className="text-xs text-content-subtle">Aucun type de vélo actif.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {bikeTypes.map((bt) => {
                        const active = selectedTypes.includes(bt.id);
                        return (
                          <button
                            type="button"
                            key={bt.id}
                            onClick={() => toggleType(bt.id)}
                            aria-pressed={active}
                            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                              active
                                ? "border-brand-500 bg-brand-50 text-brand-700"
                                : "border-border-strong text-content-muted hover:bg-surface-muted"
                            }`}
                          >
                            {bt.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {error && <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
                <Button type="submit" loading={pending}>{isEdit ? "Enregistrer" : "Créer"}</Button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}
