"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Exercise, ExerciseCategory, BikeComponent } from "@prisma/client";

const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  SOUPLESSE: "Souplesse",
  RENFORCEMENT: "Renforcement",
  MOBILITE: "Mobilité",
  PROPRIOCEPTION: "Proprioception",
  AUTRE: "Autre",
};

// ─── Summary block shown before final submit ──────────────────────────────────

function StudySummary({
  measureCount,
  components,
  exercises,
  selectedComponentIds,
  selectedExerciseIds,
}: {
  measureCount: number;
  components: BikeComponent[];
  exercises: Exercise[];
  selectedComponentIds: string[];
  selectedExerciseIds: string[];
}) {
  const selectedComponents = components.filter((c) => selectedComponentIds.includes(c.id));
  const selectedExercises = exercises.filter((e) => selectedExerciseIds.includes(e.id));

  return (
    <div className="rounded-lg border border-brand-100 bg-brand-50 p-4 space-y-3 text-sm">
      <p className="font-semibold text-brand-900">Récapitulatif de l&apos;étude</p>
      <p className="text-brand-800">
        {measureCount} mesure{measureCount !== 1 ? "s" : ""} du vélo renseignée{measureCount !== 1 ? "s" : ""}
      </p>
      {selectedComponents.length > 0 && (
        <div>
          <p className="font-medium text-brand-900">Composants ({selectedComponents.length}) :</p>
          <p className="text-brand-700">{selectedComponents.map((c) => c.name).join(", ")}</p>
        </div>
      )}
      {selectedExercises.length > 0 && (
        <div>
          <p className="font-medium text-brand-900">Exercices ({selectedExercises.length}) :</p>
          <p className="text-brand-700">{selectedExercises.map((e) => e.name).join(", ")}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  exercises: Exercise[];
  components: BikeComponent[];
  selected: string[];
  selectedComponentIds: string[];
  measureCount: number;
  onToggle: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  saving: boolean;
}

export function ExercisePicker({
  exercises,
  components,
  selected,
  selectedComponentIds,
  measureCount,
  onToggle,
  onBack,
  onNext,
  saving,
}: Props) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<ExerciseCategory | "">("");

  const categories = [...new Set(exercises.map((e) => e.category))] as ExerciseCategory[];

  const filtered = exercises.filter((e) => {
    const matchesSearch =
      !search || e.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !filterCategory || e.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-content-muted">
        Sélectionnez les exercices à prescrire au patient.
      </p>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="search"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as ExerciseCategory | "")}
          className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-brand-600 font-medium">
          {selected.length} exercice{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}
        </p>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong py-8 text-center">
          <p className="text-sm text-content-subtle">Aucun exercice dans la bibliothèque.</p>
          <p className="mt-1 text-xs text-content-subtle">Ajoutez-en depuis la section Bibliothèque.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {filtered.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={selected.includes(e.id)}
                onChange={() => onToggle(e.id)}
                className="mt-0.5 h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-content">{e.name}</p>
                <p className="text-xs text-content-muted">
                  {CATEGORY_LABELS[e.category]}
                  {e.frequency ? ` · ${e.frequency}` : ""}
                  {e.duration ? ` · ${e.duration}` : ""}
                </p>
                {e.description && (
                  <p className="mt-0.5 text-xs text-content-subtle line-clamp-1">{e.description}</p>
                )}
              </div>
            </label>
          ))}
        </div>
      )}

      {/* Summary before submit */}
      <StudySummary
        measureCount={measureCount}
        components={components}
        exercises={exercises}
        selectedComponentIds={selectedComponentIds}
        selectedExerciseIds={selected}
      />

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={onBack}>← Étape précédente</Button>
        <Button onClick={onNext} loading={saving}>
          Étape suivante →
        </Button>
      </div>
    </div>
  );
}
