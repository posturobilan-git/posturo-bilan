"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
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
  onSetValue: (physioTestId: string, value: PhysioValue) => void;
  onSetComment: (physioTestId: string, comment: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  saving: boolean;
}

const inputCls =
  "w-full rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** A two-button toggle (e.g. Positif / Négatif, Oui / Non) for a boolean result. */
function BooleanToggle({
  value,
  labels,
  ariaLabel,
  onChange,
}: {
  value: PhysioValue;
  labels: { yes: string; no: string };
  ariaLabel: string;
  onChange: (v: PhysioValue) => void;
}) {
  const current = typeof value === "boolean" ? value : null;
  return (
    <div className="flex gap-1" role="group" aria-label={ariaLabel}>
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
}: {
  test: PhysioTestForStudy;
  value: PhysioValue;
  onChange: (v: PhysioValue) => void;
}) {
  switch (test.outputType) {
    case "YES_NO":
      return (
        <BooleanToggle value={value} ariaLabel={test.name} labels={{ yes: "Oui", no: "Non" }} onChange={onChange} />
      );
    case "POSITIVE_NEGATIVE":
      return (
        <BooleanToggle value={value} ariaLabel={test.name} labels={{ yes: "Positif", no: "Négatif" }} onChange={onChange} />
      );
    case "VALUE":
    default:
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
  onSetValue,
  onSetComment,
  onBack,
  onNext,
  onSaveDraft,
  saving,
}: Props) {
  // Tests applicables à ce type de vélo : tronc commun (ordre global) + tests
  // configurés pour ce vélo. Conserve la section pour le regroupement.
  const applicable = physioTests
    .map((t) => {
      const link = bikeTypeId != null ? t.bikeTypeLinks.find((b) => b.bikeTypeId === bikeTypeId) : undefined;
      if (t.isCommon) return { t, common: true, order: t.commonOrder };
      if (link) return { t, common: false, order: link.order };
      return null;
    })
    .filter((x): x is { t: PhysioTestForStudy; common: boolean; order: number } => x !== null);

  // Regroupement par section : sections triées par leur ordre, le groupe « Autres »
  // (tests sans section) en dernier. Dans chaque section, tronc commun d'abord.
  const SANS_SECTION = "__none__";
  const groups = new Map<
    string,
    { name: string; sectionOrder: number; items: { t: PhysioTestForStudy; common: boolean; order: number }[] }
  >();
  for (const x of applicable) {
    const key = x.t.section?.id ?? SANS_SECTION;
    if (!groups.has(key)) {
      groups.set(key, {
        name: x.t.section?.name ?? "Autres",
        sectionOrder: x.t.section?.order ?? Number.MAX_SAFE_INTEGER,
        items: [],
      });
    }
    groups.get(key)!.items.push(x);
  }
  const orderedGroups = [...groups.values()]
    .sort((a, b) => a.sectionOrder - b.sectionOrder || a.name.localeCompare(b.name))
    .map((g) => ({
      ...g,
      items: g.items
        .sort((a, b) => {
          if (a.common !== b.common) return a.common ? -1 : 1;
          return a.order - b.order || a.t.name.localeCompare(b.t.name);
        })
        .map((x) => x.t),
    }));

  const hasAny = applicable.length > 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-content-muted">
        Renseignez les résultats des tests physiologiques pour ce patient.
        <span className="ml-1 text-content-subtle">Les champs marqués d&apos;un astérisque sont obligatoires.</span>
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
          <fieldset key={group.name} className="space-y-4 rounded-lg border border-border p-5">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-content-subtle">
              {group.name}
            </legend>

            {group.items.map((t) => (
              <div key={t.id} className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_auto] sm:gap-3">
                <div className="min-w-0">
                  <span className="text-sm text-content">
                    {t.name}
                    {t.outputType === "VALUE" && t.unit && (
                      <span className="ml-1 text-content-subtle">({t.unit})</span>
                    )}
                    {t.isRequired && <span className="ml-0.5 text-danger-500">*</span>}
                  </span>
                  {t.description && <DescriptionToggle description={t.description} />}
                  <CommentToggle
                    testId={t.id}
                    value={comments[t.id] ?? ""}
                    onChange={(v) => onSetComment(t.id, v)}
                  />
                </div>
                <div className="sm:w-48">
                  <PhysioInput test={t} value={results[t.id] ?? null} onChange={(v) => onSetValue(t.id, v)} />
                </div>
              </div>
            ))}
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
