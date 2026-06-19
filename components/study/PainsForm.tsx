"use client";

import { Button } from "@/components/ui/Button";
import type { PainDraft } from "@/lib/stores/studyStore";
import type { StudyPainInput } from "@/types";

const inputClass =
  "rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-content focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** True when the kiné hasn't typed anything into this pain block. */
function isEmptyPain(p: PainDraft): boolean {
  return (
    !p.location.trim() &&
    !p.type?.trim() &&
    !p.intensity?.trim() &&
    !p.restAtRest &&
    !p.activity?.trim() &&
    !p.duration?.trim() &&
    !p.aggravatingFactors?.trim() &&
    !p.relievingFactors?.trim()
  );
}

interface Props {
  pains: PainDraft[];
  onAdd: () => void;
  onRemove: (key: string) => void;
  onSetField: <K extends keyof StudyPainInput>(key: string, field: K, value: StudyPainInput[K]) => void;
  onBack: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  saving: boolean;
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-content-muted">{label}</span>
      {children}
    </label>
  );
}

export function PainsForm({
  pains,
  onAdd,
  onRemove,
  onSetField,
  onBack,
  onNext,
  onSaveDraft,
  saving,
}: Props) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-content-muted">
        Évaluez les douleurs du patient. Celles déclarées à l&apos;accueil sont
        pré-remplies — complétez-les et ajoutez-en si besoin.
        <span className="ml-1 text-content-subtle">
          Seule la localisation est obligatoire ; les blocs vides sont ignorés.
        </span>
      </p>

      {pains.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong py-8 text-center">
          <p className="text-sm text-content-subtle">Aucune douleur renseignée.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pains.map((p, i) => {
            // Hide remove on the sole remaining block while it's still empty.
            const canRemove = !(pains.length === 1 && isEmptyPain(p));
            return (
              <fieldset key={p.key} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <legend className="text-sm font-semibold text-content">
                    Douleur {i + 1}
                  </legend>
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => onRemove(p.key)}
                      className="text-xs font-medium text-danger-600 hover:text-danger-700"
                    >
                      Supprimer
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Labelled label="Localisation *">
                    <input
                      type="text"
                      value={p.location}
                      maxLength={200}
                      onChange={(e) => onSetField(p.key, "location", e.target.value)}
                      placeholder="ex : Hanches"
                      className={inputClass}
                    />
                  </Labelled>
                  <Labelled label="Type">
                    <input
                      type="text"
                      value={p.type ?? ""}
                      maxLength={200}
                      onChange={(e) => onSetField(p.key, "type", e.target.value)}
                      placeholder="ex : inflammatoires, mécaniques…"
                      className={inputClass}
                    />
                  </Labelled>
                  <Labelled label="Intensité (/10)">
                    <input
                      type="text"
                      value={p.intensity ?? ""}
                      maxLength={50}
                      onChange={(e) => onSetField(p.key, "intensity", e.target.value)}
                      placeholder="ex : 4-5"
                      className={inputClass}
                    />
                  </Labelled>
                  <Labelled label="Durée">
                    <input
                      type="text"
                      value={p.duration ?? ""}
                      maxLength={200}
                      onChange={(e) => onSetField(p.key, "duration", e.target.value)}
                      placeholder="ex : depuis 3 mois"
                      className={inputClass}
                    />
                  </Labelled>
                  <Labelled label="Activité concernée">
                    <input
                      type="text"
                      value={p.activity ?? ""}
                      maxLength={500}
                      onChange={(e) => onSetField(p.key, "activity", e.target.value)}
                      placeholder="ex : en danseuse, longues sorties…"
                      className={inputClass}
                    />
                  </Labelled>
                  <label className="flex items-center gap-2 sm:mt-6">
                    <input
                      type="checkbox"
                      checked={p.restAtRest}
                      onChange={(e) => onSetField(p.key, "restAtRest", e.target.checked)}
                      className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-content">Présente au repos</span>
                  </label>
                  <Labelled label="Ce qui augmente la douleur (↑)">
                    <textarea
                      rows={2}
                      value={p.aggravatingFactors ?? ""}
                      maxLength={1000}
                      onChange={(e) => onSetField(p.key, "aggravatingFactors", e.target.value)}
                      className={inputClass}
                    />
                  </Labelled>
                  <Labelled label="Ce qui soulage la douleur (↓)">
                    <textarea
                      rows={2}
                      value={p.relievingFactors ?? ""}
                      maxLength={1000}
                      onChange={(e) => onSetField(p.key, "relievingFactors", e.target.value)}
                      className={inputClass}
                    />
                  </Labelled>
                </div>
              </fieldset>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border-strong px-3 py-2 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50"
      >
        + Ajouter une douleur
      </button>

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
