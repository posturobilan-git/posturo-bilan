"use client";

import { Button } from "@/components/ui/Button";
import { MeasureRow, MeasuresHeader } from "./MeasureRow";
import { PhotoUpload } from "./PhotoUpload";
import type { PhotoDraft } from "@/lib/stores/studyStore";
import type { RiderMeasurement } from "@prisma/client";

export type RiderMeasurementForStudy = RiderMeasurement & {
  bikeTypeLinks: { bikeTypeId: string; order: number }[];
};

interface MeasureValue {
  before: number | null;
  after: number | null;
}

interface Props {
  /** All active mesures du cycliste, with the bike types they're linked to. */
  riderMeasurements: RiderMeasurementForStudy[];
  /** Selected bike type — determines which mesures are shown. */
  bikeTypeId: string | null;
  /** Saisies courantes, indexées par riderMeasurementId. */
  values: Record<string, MeasureValue>;
  /** Mesures ajoutées à la volée pour cette étude uniquement. */
  extraRiderMeasurementIds: string[];
  /** Photos patient (avant/après) — saisies sur cette étape. */
  photos: PhotoDraft[];
  onSetValue: (riderMeasurementId: string, field: "before" | "after", value: number | null) => void;
  onAddExtra: (riderMeasurementId: string) => void;
  onRemoveExtra: (riderMeasurementId: string) => void;
  onAddPhoto: (photo: PhotoDraft) => void;
  onUpdatePhoto: (key: string, patch: Partial<Omit<PhotoDraft, "key">>) => void;
  onRemovePhoto: (key: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  saving: boolean;
}

export function RiderMeasuresForm({
  riderMeasurements,
  bikeTypeId,
  values,
  extraRiderMeasurementIds,
  photos,
  onSetValue,
  onAddExtra,
  onRemoveExtra,
  onAddPhoto,
  onUpdatePhoto,
  onRemovePhoto,
  onBack,
  onNext,
  onSaveDraft,
  saving,
}: Props) {
  const byId = new Map(riderMeasurements.map((m) => [m.id, m]));

  // Mesures configurées pour ce type de vélo : tronc commun d'abord (ordre
  // global), puis les mesures du vélo dans l'ordre de la configuration.
  const configured = riderMeasurements
    .map((m) => {
      const link = bikeTypeId != null ? m.bikeTypeLinks.find((b) => b.bikeTypeId === bikeTypeId) : undefined;
      if (m.isCommon) return { m, common: true, order: m.commonOrder };
      if (link) return { m, common: false, order: link.order };
      return null;
    })
    .filter((x): x is { m: RiderMeasurementForStudy; common: boolean; order: number } => x !== null)
    .sort((a, b) => {
      if (a.common !== b.common) return a.common ? -1 : 1;
      return a.order - b.order || a.m.name.localeCompare(b.m.name);
    })
    .map((x) => x.m);

  const configuredIds = new Set(configured.map((m) => m.id));
  // Mesures ajoutées à la volée — affichées après les configurées, ordre d'ajout.
  const extras = extraRiderMeasurementIds
    .filter((id) => !configuredIds.has(id))
    .map((id) => byId.get(id))
    .filter((m): m is RiderMeasurementForStudy => Boolean(m));
  const shownIds = new Set([...configuredIds, ...extras.map((m) => m.id)]);

  // Reste de la bibliothèque, proposable à l'ajout ponctuel.
  const addable = riderMeasurements
    .filter((m) => !shownIds.has(m.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const shown = [...configured, ...extras];

  return (
    <div className="space-y-5">
      <p className="text-sm text-content-muted">
        Renseignez les mesures du cycliste sur le vélo, avant et après réglage.
        <span className="ml-1 text-content-subtle">
          Le delta s&apos;affiche dès que les deux valeurs sont saisies.
        </span>
      </p>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong py-8 text-center">
          <p className="text-sm text-content-subtle">Aucune mesure du cycliste définie pour ce type de vélo.</p>
          <p className="mt-1 text-xs text-content-subtle">
            Un administrateur peut en ajouter depuis la configuration de l&apos;étude,
            ou ajoutez-en une ponctuellement ci-dessous.
          </p>
        </div>
      ) : (
        <fieldset className="overflow-x-auto rounded-lg border border-border px-5 pb-1 pt-3">
          <MeasuresHeader />
          <div className="divide-y divide-border">
            {shown.map((m) => (
              <MeasureRow
                key={m.id}
                name={m.name}
                unit={m.unit}
                required={m.isRequired}
                phase="both"
                before={values[m.id]?.before ?? null}
                after={values[m.id]?.after ?? null}
                badge={!configuredIds.has(m.id) ? "Ajoutée pour cette étude" : undefined}
                onSetBefore={(v) => onSetValue(m.id, "before", v)}
                onSetAfter={(v) => onSetValue(m.id, "after", v)}
                onRemove={!configuredIds.has(m.id) ? () => onRemoveExtra(m.id) : undefined}
              />
            ))}
          </div>
        </fieldset>
      )}

      {/* Ajout ponctuel d'une mesure de la bibliothèque, pour cette étude seulement. */}
      {addable.length > 0 && (
        <label className="flex flex-col gap-1 sm:max-w-xs">
          <span className="text-xs font-medium text-content-muted">
            Ajouter une mesure du cycliste pour cette étude
          </span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onAddExtra(e.target.value);
            }}
            className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-content-muted focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">Choisir dans la bibliothèque…</option>
            {addable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.unit})
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Photos patient avant/après — rattachées à l'étape mesures cycliste. */}
      <div className="border-t border-border pt-5">
        <PhotoUpload
          photos={photos}
          onAdd={onAddPhoto}
          onUpdate={onUpdatePhoto}
          onRemove={onRemovePhoto}
        />
      </div>

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
