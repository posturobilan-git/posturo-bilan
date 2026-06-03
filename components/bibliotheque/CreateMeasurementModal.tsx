"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createMeasurement, updateMeasurement } from "@/actions/measurement.actions";
import { toast } from "@/lib/stores/toastStore";
import { MEASUREMENT_CATEGORIES, MEASUREMENT_CATEGORY_LABELS } from "@/lib/labels";
import type { MeasurementCategory } from "@prisma/client";

interface BikeTypeOption {
  id: string;
  name: string;
}

interface MeasurementValue {
  id: string;
  name: string;
  unit: string;
  category: MeasurementCategory;
  order: number;
  isCommon: boolean;
  bikeTypes: { id: string; name: string }[];
}

export function CreateMeasurementModal({
  measurement,
  bikeTypes,
}: {
  measurement?: MeasurementValue;
  bikeTypes: BikeTypeOption[];
}) {
  const isEdit = Boolean(measurement);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [isCommon, setIsCommon] = useState(measurement?.isCommon ?? false);
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
    setSelectedTypes(measurement?.bikeTypes.map((b) => b.id) ?? []);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      unit: String(fd.get("unit") ?? "").trim(),
      category: String(fd.get("category") ?? "AUTRE") as MeasurementCategory,
      order: Number(fd.get("order") ?? 0),
      isCommon,
      bikeTypeIds: isCommon ? [] : selectedTypes,
    };

    setError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateMeasurement(measurement!.id, payload)
        : await createMeasurement(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isEdit ? "Côte modifiée." : "Côte créée.");
      setOpen(false);
    });
  }

  return (
    <>
      {isEdit ? (
        <button
          onClick={() => { reset(); setOpen(true); }}
          className="text-sm font-medium text-brand-600 hover:text-brand-800"
        >
          Éditer
        </button>
      ) : (
        <Button className="w-full sm:w-auto" onClick={() => { reset(); setOpen(true); }}>+ Nouvelle côte</Button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {isEdit ? "Modifier la côte" : "Nouvelle côte"}
              </h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100" aria-label="Fermer">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">Nom <span className="text-red-500">*</span></span>
                <input name="name" required defaultValue={measurement?.name} placeholder="Hauteur de selle"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">Unité <span className="text-red-500">*</span></span>
                  <input name="unit" required defaultValue={measurement?.unit} placeholder="cm, mm, °"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">Catégorie</span>
                  <select name="category" defaultValue={measurement?.category ?? "AUTRE"}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                    {MEASUREMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{MEASUREMENT_CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">Ordre</span>
                  <input name="order" type="number" min={0} defaultValue={measurement?.order ?? 0}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </label>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isCommon}
                  onChange={(e) => setIsCommon(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm font-medium text-gray-700">Tronc commun (s&apos;applique à tous les types de vélo)</span>
              </label>

              {!isCommon && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-gray-700">Types de vélo concernés</span>
                  {bikeTypes.length === 0 ? (
                    <p className="text-xs text-gray-400">Aucun type de vélo actif.</p>
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
                                : "border-gray-300 text-gray-600 hover:bg-gray-50"
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

              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
                <Button type="submit" loading={pending}>{isEdit ? "Enregistrer" : "Créer"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
