"use client";

import { Button } from "@/components/ui/Button";
import { MEASUREMENT_CATEGORY_LABELS } from "@/lib/labels";
import type { Measurement, MeasurementCategory } from "@prisma/client";

export type MeasurementForStudy = Measurement & { bikeTypes: { id: string }[] };

interface MeasureValue {
  before: number | null;
  after: number | null;
}

interface Props {
  /** All active côtes, with the bike types they're linked to. */
  measurements: MeasurementForStudy[];
  /** Selected bike type — determines which côtes are shown. */
  bikeTypeId: string | null;
  /** Saisies courantes, indexées par measurementId. */
  values: Record<string, MeasureValue>;
  observations: string;
  onSetValue: (measurementId: string, field: "before" | "after", value: number | null) => void;
  onSetObservations: (text: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  saving: boolean;
}

function NumberInput({
  value,
  placeholder,
  onChange,
}: {
  value: number | null;
  placeholder: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      step="0.1"
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    />
  );
}

export function MeasuresForm({
  measurements,
  bikeTypeId,
  values,
  observations,
  onSetValue,
  onSetObservations,
  onBack,
  onNext,
  onSaveDraft,
  saving,
}: Props) {
  // Côtes applicables : tronc commun + celles liées au vélo sélectionné.
  const applicable = measurements.filter(
    (m) => m.isCommon || (bikeTypeId != null && m.bikeTypes.some((b) => b.id === bikeTypeId))
  );

  // Regroupées par catégorie pour l'affichage (déjà triées par `order`).
  const byCategory = new Map<MeasurementCategory, MeasurementForStudy[]>();
  for (const m of applicable) {
    const list = byCategory.get(m.category) ?? [];
    list.push(m);
    byCategory.set(m.category, list);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Renseignez les côtes (avant / après) pour ce type de vélo.
      </p>

      {applicable.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-8 text-center">
          <p className="text-sm text-gray-400">Aucune côte définie pour ce type de vélo.</p>
          <p className="mt-1 text-xs text-gray-400">
            Un administrateur peut en ajouter depuis la Bibliothèque (onglet Côtes).
          </p>
        </div>
      ) : (
        [...byCategory.entries()].map(([category, items]) => (
          <fieldset key={category} className="space-y-3 rounded-lg border border-gray-200 p-5">
            <legend className="px-1 text-sm font-semibold text-gray-700">
              {MEASUREMENT_CATEGORY_LABELS[category]}
            </legend>

            {/* Column headers */}
            <div className="hidden grid-cols-[1fr_auto_auto] items-center gap-3 sm:grid">
              <span />
              <span className="w-28 text-center text-xs font-medium uppercase tracking-wide text-gray-400">Avant</span>
              <span className="w-28 text-center text-xs font-medium uppercase tracking-wide text-gray-400">Après</span>
            </div>

            {items.map((m) => {
              const v = values[m.id] ?? { before: null, after: null };
              return (
                <div key={m.id} className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_auto_auto]">
                  <span className="col-span-2 text-sm text-gray-700 sm:col-span-1">
                    {m.name}
                    <span className="ml-1 text-gray-400">({m.unit})</span>
                  </span>
                  <div className="sm:w-28">
                    <span className="mb-1 block text-xs text-gray-400 sm:hidden">Avant</span>
                    <NumberInput value={v.before} placeholder="—" onChange={(val) => onSetValue(m.id, "before", val)} />
                  </div>
                  <div className="sm:w-28">
                    <span className="mb-1 block text-xs text-gray-400 sm:hidden">Après</span>
                    <NumberInput value={v.after} placeholder="—" onChange={(val) => onSetValue(m.id, "after", val)} />
                  </div>
                </div>
              );
            })}
          </fieldset>
        ))
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-600">Observations libres</span>
        <textarea
          rows={4}
          maxLength={3000}
          value={observations}
          onChange={(e) => onSetObservations(e.target.value)}
          placeholder="Remarques posturales, asymétries observées…"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack}>← Étape précédente</Button>
        <div className="flex justify-between gap-3 sm:justify-end">
          <Button variant="secondary" onClick={onSaveDraft} loading={saving}>
            Sauvegarder brouillon
          </Button>
          <Button onClick={onNext} loading={saving}>
            Étape suivante →
          </Button>
        </div>
      </div>
    </div>
  );
}
