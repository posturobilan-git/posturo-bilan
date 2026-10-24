"use client";

import { Button } from "@/components/ui/Button";
import { fieldKey } from "@/lib/study/required-fields";
import { MeasureRow, MeasuresHeader } from "./MeasureRow";
import type { Measurement } from "@prisma/client";

export type MeasurementForStudy = Measurement & {
  bikeTypeLinks: { bikeTypeId: string; order: number }[];
};

interface MeasureValue {
  before: number | null;
  after: number | null;
}

interface Props {
  /** All active côtes, with the bike types they're linked to. */
  measurements: MeasurementForStudy[];
  /** Selected bike type — determines which côtes are shown. */
  bikeTypeId: string | null;
  /** Which column this step fills: mesures avant ou après. */
  phase: "before" | "after";
  /** Saisies courantes, indexées par measurementId. */
  values: Record<string, MeasureValue>;
  /** Côtes ajoutées à la volée pour cette étude uniquement. */
  extraMeasurementIds: string[];
  /** Valeurs obligatoires encore vides (`fieldKey`), signalées après un passage bloqué. */
  invalidKeys: ReadonlySet<string>;
  /** Valeurs qui l'étaient lors d'un passage bloqué : leur ligne de message garde sa place. */
  reservedKeys: ReadonlySet<string>;
  observations: string;
  onSetValue: (measurementId: string, field: "before" | "after", value: number | null) => void;
  onAddExtra: (measurementId: string) => void;
  onRemoveExtra: (measurementId: string) => void;
  onSetObservations: (text: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  saving: boolean;
}

export function MeasuresForm({
  measurements,
  bikeTypeId,
  phase,
  values,
  extraMeasurementIds,
  invalidKeys,
  reservedKeys,
  observations,
  onSetValue,
  onAddExtra,
  onRemoveExtra,
  onSetObservations,
  onBack,
  onNext,
  onSaveDraft,
  saving,
}: Props) {
  const byId = new Map(measurements.map((m) => [m.id, m]));

  // Côtes configurées pour ce type de vélo : tronc commun d'abord
  // (alphabétique), puis les côtes du vélo dans l'ordre de la configuration.
  const configured = measurements
    .map((m) => {
      const link = bikeTypeId != null ? m.bikeTypeLinks.find((b) => b.bikeTypeId === bikeTypeId) : undefined;
      if (m.isCommon) return { m, common: true, order: m.commonOrder };
      if (link) return { m, common: false, order: link.order };
      return null;
    })
    .filter((x): x is { m: MeasurementForStudy; common: boolean; order: number } => x !== null)
    .sort((a, b) => {
      if (a.common !== b.common) return a.common ? -1 : 1;
      return a.order - b.order || a.m.name.localeCompare(b.m.name);
    })
    .map((x) => x.m);

  const configuredIds = new Set(configured.map((m) => m.id));
  // Côtes ajoutées à la volée — affichées après les configurées, ordre d'ajout.
  const extras = extraMeasurementIds
    .filter((id) => !configuredIds.has(id))
    .map((id) => byId.get(id))
    .filter((m): m is MeasurementForStudy => Boolean(m));
  const shownIds = new Set([...configuredIds, ...extras.map((m) => m.id)]);

  // Reste de la bibliothèque, proposable à l'ajout ponctuel.
  const addable = measurements
    .filter((m) => !shownIds.has(m.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const isAfter = phase === "after";
  const shown = [...configured, ...extras];
  // Une côte obligatoire exige « avant » ET « après » (voir lib/study/required-fields.ts),
  // mais seulement les côtes configurées : pas celles ajoutées à la volée.
  const hasRequired = configured.some((m) => m.isRequired);

  return (
    <div className="space-y-5">
      <p className="text-sm text-content-muted">
        {isAfter
          ? "Renseignez les mesures du vélo après réglage. Le delta s'affiche par rapport à la valeur avant."
          : "Renseignez les mesures du vélo relevées avant réglage."}
        {hasRequired && (
          <span className="ml-1 text-content-subtle">
            {isAfter
              ? "Les mesures signalées « Obligatoire » doivent aussi être renseignées après réglage pour passer à l'étape suivante."
              : "Les mesures signalées « Obligatoire » sont à renseigner avant (ici) et après réglage."}
          </span>
        )}
      </p>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong py-8 text-center">
          <p className="text-sm text-content-subtle">Aucune mesure du vélo définie pour ce type de vélo.</p>
          <p className="mt-1 text-xs text-content-subtle">
            Un administrateur peut en ajouter depuis la configuration de l&apos;étude,
            ou ajoutez-en une ponctuellement ci-dessous.
          </p>
        </div>
      ) : (
        <fieldset className="overflow-x-auto rounded-lg border border-border px-5 pb-1 pt-3">
          {isAfter && <MeasuresHeader />}
          <div className="divide-y divide-border">
            {shown.map((m) => {
              const v = values[m.id] ?? { before: null, after: null };
              const extra = !configuredIds.has(m.id);
              return (
                <MeasureRow
                  key={m.id}
                  name={m.name}
                  unit={m.unit}
                  required={!extra && m.isRequired}
                  invalidBefore={invalidKeys.has(fieldKey(m.id, "before"))}
                  invalidAfter={invalidKeys.has(fieldKey(m.id, "after"))}
                  reservedBefore={reservedKeys.has(fieldKey(m.id, "before"))}
                  reservedAfter={reservedKeys.has(fieldKey(m.id, "after"))}
                  phase={phase}
                  before={v.before}
                  after={v.after}
                  badge={extra ? "Ajoutée pour cette étude" : undefined}
                  onSetBefore={(val) => onSetValue(m.id, "before", val)}
                  onSetAfter={(val) => onSetValue(m.id, "after", val)}
                  onRemove={extra ? () => onRemoveExtra(m.id) : undefined}
                />
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Ajout ponctuel d'une côte de la bibliothèque, pour cette étude seulement. */}
      {addable.length > 0 && (
        <label className="flex flex-col gap-1 sm:max-w-xs">
          <span className="text-xs font-medium text-content-muted">
            Ajouter une mesure du vélo pour cette étude
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

      {isAfter && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-content-muted">Observations libres</span>
          <textarea
            rows={4}
            maxLength={3000}
            value={observations}
            onChange={(e) => onSetObservations(e.target.value)}
            placeholder="Remarques posturales, asymétries observées…"
            className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-content focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      )}

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
