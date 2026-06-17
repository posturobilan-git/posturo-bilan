"use client";

import { Button } from "@/components/ui/Button";
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
      inputMode="decimal"
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
      className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-content focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    />
  );
}

// Déclaré au niveau module (et non dans MeasuresForm) : une déclaration inline
// changerait d'identité à chaque frappe, forçant React à démonter/remonter
// l'input en cours de saisie (perte de focus + scroll inattendu vers le haut).
function MeasureRow({
  m,
  extra,
  value,
  phase,
  onSetValue,
  onRemoveExtra,
}: {
  m: MeasurementForStudy;
  extra: boolean;
  value: MeasureValue;
  phase: "before" | "after";
  onSetValue: Props["onSetValue"];
  onRemoveExtra: Props["onRemoveExtra"];
}) {
  const isAfter = phase === "after";
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
      <span className="text-sm text-content">
        {m.name}
        <span className="ml-1 text-content-subtle">({m.unit})</span>
        {m.isRequired && <span className="ml-0.5 text-danger-500">*</span>}
        {extra && (
          <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            Ajoutée pour cette étude
          </span>
        )}
        {/* En phase après, rappel de la valeur avant en référence. */}
        {isAfter && value.before != null && (
          <span className="ml-2 text-xs text-content-subtle">Avant : {value.before} {m.unit}</span>
        )}
      </span>
      <div className="w-32 sm:w-36">
        <NumberInput
          value={isAfter ? value.after : value.before}
          placeholder="—"
          onChange={(val) => onSetValue(m.id, phase, val)}
        />
      </div>
      <div className="w-7">
        {extra && (
          <button
            type="button"
            onClick={() => onRemoveExtra(m.id)}
            aria-label={`Retirer ${m.name}`}
            title="Retirer cette côte de l'étude"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border-strong text-content-subtle transition-colors hover:bg-danger-50 hover:text-danger-600"
          >
            −
          </button>
        )}
      </div>
    </div>
  );
}

export function MeasuresForm({
  measurements,
  bikeTypeId,
  phase,
  values,
  extraMeasurementIds,
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

  return (
    <div className="space-y-5">
      <p className="text-sm text-content-muted">
        {isAfter
          ? "Renseignez les côtes après ajustement de la position."
          : "Renseignez les côtes relevées avant ajustement."}
      </p>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong py-8 text-center">
          <p className="text-sm text-content-subtle">Aucune côte définie pour ce type de vélo.</p>
          <p className="mt-1 text-xs text-content-subtle">
            Un administrateur peut en ajouter depuis la configuration de l&apos;étude,
            ou ajoutez-en une ponctuellement ci-dessous.
          </p>
        </div>
      ) : (
        <fieldset className="space-y-3 rounded-lg border border-border p-5">
          <div className="hidden grid-cols-[1fr_auto_auto] items-center gap-3 sm:grid">
            <span />
            <span className="w-36 text-center text-xs font-medium uppercase tracking-wide text-content-subtle">
              {isAfter ? "Après" : "Avant"}
            </span>
            <span className="w-7" />
          </div>
          {shown.map((m) => (
            <MeasureRow
              key={m.id}
              m={m}
              extra={!configuredIds.has(m.id)}
              value={values[m.id] ?? { before: null, after: null }}
              phase={phase}
              onSetValue={onSetValue}
              onRemoveExtra={onRemoveExtra}
            />
          ))}
        </fieldset>
      )}

      {/* Ajout ponctuel d'une côte de la bibliothèque, pour cette étude seulement. */}
      {addable.length > 0 && (
        <label className="flex flex-col gap-1 sm:max-w-xs">
          <span className="text-xs font-medium text-content-muted">
            Ajouter une côte pour cette étude
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
