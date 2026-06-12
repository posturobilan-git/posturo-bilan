"use client";

import { Button } from "@/components/ui/Button";
import type { PhysioTest } from "@prisma/client";
import type { PhysioValue } from "@/lib/physio";

export type PhysioTestForStudy = PhysioTest & {
  bikeTypeLinks: { bikeTypeId: string; order: number }[];
};

interface Props {
  /** All active physio tests, with the bike types they're linked to. */
  physioTests: PhysioTestForStudy[];
  /** Selected bike type — determines which tests are shown. */
  bikeTypeId: string | null;
  /** Résultats courants (une valeur par test), indexés par physioTestId. */
  results: Record<string, PhysioValue>;
  onSetValue: (physioTestId: string, value: PhysioValue) => void;
  onBack: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  saving: boolean;
}

/** Renders the result input matching the test's outputType. */
function PhysioInput({
  test,
  value,
  onChange,
}: {
  test: PhysioTestForStudy;
  value: PhysioValue;
  onChange: (v: PhysioValue) => void;
}) {
  const inputCls =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  switch (test.outputType) {
    case "VALUE":
      return (
        <input
          type="number"
          step="0.1"
          placeholder="—"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
          className={inputCls}
        />
      );
    case "YES_NO": {
      const current = typeof value === "boolean" ? value : null;
      return (
        <div className="flex gap-1" role="group" aria-label={test.name}>
          {([true, false] as const).map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={current === v}
              // Re-clicking the active choice clears the answer back to "—".
              onClick={() => onChange(current === v ? null : v)}
              className={`flex-1 rounded-md border px-2 py-2 text-sm transition-colors ${
                current === v
                  ? v
                    ? "border-success-500 bg-success-50 font-medium text-success-700"
                    : "border-danger-500 bg-danger-50 font-medium text-danger-700"
                  : "border-gray-300 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {v ? "Oui" : "Non"}
            </button>
          ))}
        </div>
      );
    }
    case "COMMENT":
    default:
      return (
        <input
          type="text"
          maxLength={2000}
          placeholder="—"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          className={inputCls}
        />
      );
  }
}

export function PhysioTestsForm({
  physioTests,
  bikeTypeId,
  results,
  onSetValue,
  onBack,
  onNext,
  onSaveDraft,
  saving,
}: Props) {
  // Tests applicables, dans l'ordre configuré pour ce type de vélo : tronc
  // commun d'abord (alphabétique), puis les tests propres au vélo dans l'ordre
  // défini dans la configuration de l'étude.
  const applicable = physioTests
    .map((t) => {
      const link = bikeTypeId != null ? t.bikeTypeLinks.find((b) => b.bikeTypeId === bikeTypeId) : undefined;
      if (t.isCommon) return { t, common: true, order: 0 };
      if (link) return { t, common: false, order: link.order };
      return null;
    })
    .filter((x): x is { t: PhysioTestForStudy; common: boolean; order: number } => x !== null)
    .sort((a, b) => {
      if (a.common !== b.common) return a.common ? -1 : 1;
      if (a.common) return a.t.name.localeCompare(b.t.name);
      return a.order - b.order || a.t.name.localeCompare(b.t.name);
    })
    .map((x) => x.t);

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Renseignez les résultats des tests physiologiques pour ce patient.
      </p>

      {applicable.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-8 text-center">
          <p className="text-sm text-gray-400">Aucun test physio défini pour ce type de vélo.</p>
          <p className="mt-1 text-xs text-gray-400">
            Un administrateur peut en ajouter depuis la configuration de l&apos;étude.
          </p>
        </div>
      ) : (
        <fieldset className="space-y-4 rounded-lg border border-gray-200 p-5">
          {/* Column header */}
          <div className="hidden grid-cols-[1fr_auto] items-center gap-3 sm:grid">
            <span />
            <span className="w-48 text-center text-xs font-medium uppercase tracking-wide text-gray-400">Résultat</span>
          </div>

          {applicable.map((t) => (
            <div key={t.id} className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_auto] sm:gap-3">
              <div>
                <span className="text-sm text-gray-700">
                  {t.name}
                  {t.outputType === "VALUE" && t.unit && (
                    <span className="ml-1 text-gray-400">({t.unit})</span>
                  )}
                </span>
                {t.description && (
                  <p className="mt-0.5 text-xs text-gray-400">{t.description}</p>
                )}
              </div>
              <div className="sm:w-48">
                <PhysioInput test={t} value={results[t.id] ?? null} onChange={(v) => onSetValue(t.id, v)} />
              </div>
            </div>
          ))}
        </fieldset>
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
