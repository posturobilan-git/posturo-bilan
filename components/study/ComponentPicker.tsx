"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { BikeComponent, ComponentCategory } from "@prisma/client";

export type ComponentForStudy = BikeComponent & { bikeTypes: { id: string }[] };

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  SELLE: "Selle",
  POTENCE: "Potence",
  CINTRE: "Cintre",
  CALE_PIEDS: "Cale-pieds",
  MANIVELLES: "Manivelles",
  PEDALES: "Pédales",
  AUTRE: "Autre",
};

interface Props {
  components: ComponentForStudy[];
  /** Selected bike type — only compatible (or universal) components are shown. */
  bikeTypeId: string | null;
  selected: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ComponentPicker({ components, bikeTypeId, selected, onToggle, onBack, onNext }: Props) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<ComponentCategory | "">("");

  // Only components compatible with the study's bike type (no types = universal).
  const compatible = components.filter(
    (c) => c.bikeTypes.length === 0 || (bikeTypeId != null && c.bikeTypes.some((b) => b.id === bikeTypeId))
  );

  const categories = [...new Set(compatible.map((c) => c.category))] as ComponentCategory[];

  const filtered = compatible.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.brand ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !filterCategory || c.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Sélectionnez les composants modifiés ou essayés pendant l&apos;étude.
      </p>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="search"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as ComponentCategory | "")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {/* Selected count */}
      {selected.length > 0 && (
        <p className="text-xs text-brand-600 font-medium">
          {selected.length} composant{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}
        </p>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-8 text-center">
          <p className="text-sm text-gray-400">Aucun composant compatible avec ce type de vélo.</p>
          <p className="mt-1 text-xs text-gray-400">
            Associez des composants à ce vélo depuis la Bibliothèque.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {filtered.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => onToggle(c.id)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                <p className="text-xs text-gray-500">
                  {CATEGORY_LABELS[c.category]}
                  {c.brand ? ` · ${c.brand}` : ""}
                  {c.model ? ` ${c.model}` : ""}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={onBack}>← Étape précédente</Button>
        <Button onClick={onNext}>Étape suivante →</Button>
      </div>
    </div>
  );
}
