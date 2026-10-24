"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { missingControlProps, missingRowProps } from "@/lib/study/focus-missing";
import { fieldKey } from "@/lib/study/required-fields";
import { appliesToBikeType, comparePhysioConfigured } from "@/lib/study/config-order";
import { FieldError } from "./FieldError";
import { INVALID_ROW_BASE, RequiredMark } from "./RequiredMark";
import type { PhysioTest } from "@prisma/client";
import type { PhysioValue } from "@/lib/physio";

export type PhysioTestForStudy = PhysioTest & {
  bikeTypeLinks: { bikeTypeId: string; order: number }[];
  section: { id: string; name: string; order: number } | null;
};

interface Props {
  /** All active physio tests, with the bike types they're linked to. */
  physioTests: PhysioTestForStudy[];
  /** Selected bike type — determines which tests are shown. */
  bikeTypeId: string | null;
  /** Résultats courants (une valeur par test), indexés par physioTestId. */
  results: Record<string, PhysioValue>;
  /** Commentaires libres optionnels, indexés par physioTestId. */
  comments: Record<string, string>;
  /** Résultats obligatoires encore vides (`fieldKey`), signalés après un passage bloqué. */
  invalidKeys: ReadonlySet<string>;
  /** Résultats qui l'étaient lors d'un passage bloqué : leur ligne de message garde sa place. */
  reservedKeys: ReadonlySet<string>;
  onSetValue: (physioTestId: string, value: PhysioValue) => void;
  onSetComment: (physioTestId: string, comment: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  saving: boolean;
}

const inputCls =
  "w-full rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
// Même boîte, en alerte : résultat obligatoire resté vide après un passage bloqué.
const inputInvalidCls =
  "w-full rounded-md border border-danger-500 bg-surface px-3 py-2 text-sm focus:border-danger-500 focus:outline-none focus:ring-1 focus:ring-danger-500";

/** The state a required result can be in, passed down to its input. */
interface RequiredState {
  /** Résultat obligatoire pour passer à l'étape suivante. */
  required: boolean;
  /** Obligatoire et encore vide après un passage bloqué. */
  invalid: boolean;
  /** Id du message d'erreur affiché sous le contrôle quand `invalid`. */
  errorId: string;
}

/** A two-button toggle (e.g. Positif / Négatif, Oui / Non) for a boolean result. */
function BooleanToggle({
  value,
  labels,
  ariaLabel,
  onChange,
  required,
  invalid,
  errorId,
}: RequiredState & {
  value: PhysioValue;
  labels: { yes: string; no: string };
  ariaLabel: string;
  onChange: (v: PhysioValue) => void;
}) {
  const current = typeof value === "boolean" ? value : null;
  return (
    // Ni aria-required ni aria-invalid sur un rôle « group » (non supportés) : l'obligation
    // passe par le nom du groupe, le message d'erreur par aria-describedby sur les boutons
    // (le focus d'un passage bloqué arrive sur le premier : un lecteur d'écran ne lit pas
    // la description d'un groupe quand c'est un bouton qui prend le focus).
    <div
      className="flex gap-1"
      role="group"
      aria-label={required ? `${ariaLabel} (obligatoire)` : ariaLabel}
    >
      {([true, false] as const).map((v, i) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={current === v}
          aria-describedby={invalid ? errorId : undefined}
          // Le focus d'un passage bloqué arrive sur le premier bouton du groupe.
          {...(i === 0 ? missingControlProps(invalid) : {})}
          // Re-clicking the active choice clears the answer back to "—".
          onClick={() => onChange(current === v ? null : v)}
          className={`flex-1 rounded-md border px-2 py-2 text-sm transition-colors ${
            current === v
              ? v
                ? "border-success-500 bg-success-50 font-medium text-success-700"
                : "border-danger-500 bg-danger-50 font-medium text-danger-700"
              : invalid
                ? "border-danger-500 bg-surface text-content-muted hover:bg-surface-muted"
                : "border-border-strong text-content-muted hover:bg-surface-muted"
          }`}
        >
          {v ? labels.yes : labels.no}
        </button>
      ))}
    </div>
  );
}

/** Renders the result input matching the test's outputType. */
function PhysioInput({
  test,
  value,
  onChange,
  required,
  invalid,
  errorId,
}: RequiredState & {
  test: PhysioTestForStudy;
  value: PhysioValue;
  onChange: (v: PhysioValue) => void;
}) {
  const state = { required, invalid, errorId };
  switch (test.outputType) {
    case "YES_NO":
      return (
        <BooleanToggle
          {...state}
          value={value}
          ariaLabel={test.name}
          labels={{ yes: "Oui", no: "Non" }}
          onChange={onChange}
        />
      );
    case "POSITIVE_NEGATIVE":
      return (
        <BooleanToggle
          {...state}
          value={value}
          ariaLabel={test.name}
          labels={{ yes: "Positif", no: "Négatif" }}
          onChange={onChange}
        />
      );
    case "VALUE":
    default:
      return (
        <input
          type="number"
          step="0.1"
          placeholder="—"
          aria-label={test.name}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          {...missingControlProps(invalid)}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
          className={invalid ? inputInvalidCls : inputCls}
        />
      );
  }
}

/** A discreet toggle that reveals the test's (long) description on demand. */
function DescriptionToggle({ description }: { description: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-0.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs text-content-subtle transition-colors hover:text-content-muted"
      >
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        Description
      </button>
      {open && <p className="mt-1 text-xs text-content-subtle">{description}</p>}
    </div>
  );
}

/** A discreet "+ Commentaire" button revealing a free-text note (shown in the report). */
function CommentToggle({
  testId,
  value,
  onChange,
}: {
  testId: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // Open by default when a comment already exists (e.g. when editing a study).
  const [open, setOpen] = useState(value.trim().length > 0);
  return (
    <div className="mt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`comment-${testId}`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs font-medium text-content-muted transition-colors hover:text-content"
      >
        <span className="text-base leading-none">{open ? "−" : "+"}</span>
        Commentaire
        {!open && value.trim() && <span className="text-brand-600">•</span>}
      </button>
      {open && (
        <textarea
          id={`comment-${testId}`}
          rows={2}
          maxLength={2000}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Note ajoutée au rapport…"
          className={`mt-1.5 ${inputCls}`}
        />
      )}
    </div>
  );
}

export function PhysioTestsForm({
  physioTests,
  bikeTypeId,
  results,
  comments,
  invalidKeys,
  reservedKeys,
  onSetValue,
  onSetComment,
  onBack,
  onNext,
  onSaveDraft,
  saving,
}: Props) {
  // Tests applicables à ce type de vélo (tronc commun compris), triés par section
  // puis dans l'ordre de la configuration du vélo : l'ordre visuel de l'écran.
  const applicable = physioTests
    .filter((t) => appliesToBikeType(t, bikeTypeId))
    .sort(comparePhysioConfigured(bikeTypeId));

  // Regroupement par section : sections dans leur ordre, le groupe « Autres »
  // (tests sans section) en dernier. La liste étant déjà triée par section, les
  // groupes sortent dans le bon ordre (Map = ordre d'insertion), et chacun garde
  // l'ordre configuré de ses tests.
  const SANS_SECTION = "__none__";
  const groups = new Map<string, { name: string; items: PhysioTestForStudy[] }>();
  for (const t of applicable) {
    const key = t.section?.id ?? SANS_SECTION;
    if (!groups.has(key)) groups.set(key, { name: t.section?.name ?? "Autres", items: [] });
    groups.get(key)!.items.push(t);
  }
  const orderedGroups = [...groups.entries()].map(([key, g]) => ({ key, ...g }));

  const hasAny = applicable.length > 0;
  // Les tests affichés sont tous applicables au vélo : isRequired suffit à dire
  // qu'ils bloquent le passage à l'étape suivante.
  const hasRequired = applicable.some((t) => t.isRequired);

  return (
    <div className="space-y-5">
      <p className="text-sm text-content-muted">
        Renseignez les résultats des tests physiologiques pour ce patient.
        {hasRequired && (
          <span className="ml-1 text-content-subtle">
            Les tests signalés « Obligatoire » doivent être renseignés pour passer à l&apos;étape suivante.
          </span>
        )}
      </p>

      {!hasAny ? (
        <div className="rounded-lg border border-dashed border-border-strong py-8 text-center">
          <p className="text-sm text-content-subtle">Aucun test physio défini pour ce type de vélo.</p>
          <p className="mt-1 text-xs text-content-subtle">
            Un administrateur peut en ajouter depuis la configuration de l&apos;étude.
          </p>
        </div>
      ) : (
        orderedGroups.map((group) => (
          <fieldset key={group.key} className="space-y-4 rounded-lg border border-border p-5">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-content-subtle">
              {group.name}
            </legend>

            {group.items.map((t) => {
              const invalid = invalidKeys.has(fieldKey(t.id));
              const errorId = `physio-error-${t.id}`;
              const errorText = t.outputType === "VALUE" ? "Valeur obligatoire" : "Réponse obligatoire";
              return (
                <div
                  key={t.id}
                  {...missingRowProps(invalid)}
                  className={`grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_auto] sm:gap-3 ${
                    invalid ? `${INVALID_ROW_BASE} before:-inset-y-2` : ""
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-sm text-content">
                      {t.name}
                      {t.outputType === "VALUE" && t.unit && (
                        <span className="ml-1 text-content-subtle">({t.unit})</span>
                      )}
                      {t.isRequired && <RequiredMark invalid={invalid} />}
                    </span>
                    {t.description && <DescriptionToggle description={t.description} />}
                    <CommentToggle
                      testId={t.id}
                      value={comments[t.id] ?? ""}
                      onChange={(v) => onSetComment(t.id, v)}
                    />
                  </div>
                  <div className="sm:w-48">
                    <PhysioInput
                      test={t}
                      value={results[t.id] ?? null}
                      onChange={(v) => onSetValue(t.id, v)}
                      required={t.isRequired}
                      invalid={invalid}
                      errorId={errorId}
                    />
                    <FieldError
                      id={errorId}
                      message={invalid ? errorText : null}
                      reserve={invalid || reservedKeys.has(fieldKey(t.id)) ? errorText : undefined}
                    />
                  </div>
                </div>
              );
            })}
          </fieldset>
        ))
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
