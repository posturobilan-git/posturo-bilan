"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { BikeComponent, ComponentAttribute } from "@prisma/client";

export type ComponentForStudy = BikeComponent & {
  bikeTypes: { id: string }[];
  category: { name: string };
  attributeValues: Array<{
    attributeId: string;
    valueText: string | null;
    valueNumber: number | null;
    valueBoolean: boolean | null;
  }>;
};

function attributeValueText(
  attribute: ComponentAttribute,
  value?: { valueText: string | null; valueNumber: number | null; valueBoolean: boolean | null }
): string | null {
  if (!value) return null;
  if (attribute.type === "NUMBER") return value.valueNumber != null ? String(value.valueNumber) : null;
  if (attribute.type === "BOOLEAN") return value.valueBoolean != null ? String(value.valueBoolean) : null;
  return value.valueText;
}

function humanizeOption(value: string): string {
  if (value === "true") return "Oui";
  if (value === "false") return "Non";
  return value;
}

interface Props {
  components: ComponentForStudy[];
  categories: { id: string; name: string }[];
  attributesByCategory: Record<string, ComponentAttribute[]>;
  /** Selected bike type — only compatible (or universal) components are shown. */
  bikeTypeId: string | null;
  selected: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ComponentPicker({
  components,
  categories,
  attributesByCategory,
  bikeTypeId,
  selected,
  onToggle,
  onBack,
  onNext,
}: Props) {
  const [search, setSearch] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string>>({});

  // Only components compatible with the study's bike type (no types = universal).
  const compatible = components.filter(
    (c) => c.bikeTypes.length === 0 || (bikeTypeId != null && c.bikeTypes.some((b) => b.id === bikeTypeId))
  );

  // Filtres par attribut : générés depuis les attributs actifs de la catégorie
  // sélectionnée. Cette liste tient entièrement en mémoire (pas de pagination
  // ici, contrairement à la bibliothèque), donc les valeurs distinctes se
  // dérivent directement des composants déjà chargés.
  const attributeOptions = filterCategoryId
    ? (attributesByCategory[filterCategoryId] ?? [])
        .filter((a) => a.type !== "TEXT")
        .map((attribute) => {
          const values = [
            ...new Set(
              compatible
                .filter((c) => c.categoryId === filterCategoryId)
                .map((c) => attributeValueText(attribute, c.attributeValues.find((v) => v.attributeId === attribute.id)))
                .filter((v): v is string => v != null)
            ),
          ].sort((a, b) => (attribute.type === "NUMBER" ? Number(a) - Number(b) : a.localeCompare(b)));
          return { attribute, values };
        })
        .filter((o) => o.values.length > 0)
    : [];

  function setAttributeFilter(attributeId: string, value: string) {
    setAttributeFilters((prev) => {
      const next = { ...prev };
      if (value) next[attributeId] = value;
      else delete next[attributeId];
      return next;
    });
  }

  const filtered = compatible.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.brand ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !filterCategoryId || c.categoryId === filterCategoryId;
    const matchesAttributes = Object.entries(attributeFilters).every(([attributeId, value]) => {
      const attribute = attributesByCategory[c.categoryId]?.find((a) => a.id === attributeId);
      if (!attribute) return true; // filtre d'une autre catégorie, ignoré
      return attributeValueText(attribute, c.attributeValues.find((v) => v.attributeId === attributeId)) === value;
    });
    return matchesSearch && matchesCategory && matchesAttributes;
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-content-muted">
        Sélectionnez les composants modifiés ou essayés pendant l&apos;étude.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <select
          value={filterCategoryId}
          onChange={(e) => {
            setFilterCategoryId(e.target.value);
            setAttributeFilters({});
          }}
          className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {attributeOptions.map(({ attribute, values }) => (
          <select
            key={attribute.id}
            value={attributeFilters[attribute.id] ?? ""}
            onChange={(e) => setAttributeFilter(attribute.id, e.target.value)}
            className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">{attribute.name}</option>
            {values.map((v) => (
              <option key={v} value={v}>{humanizeOption(v)}</option>
            ))}
          </select>
        ))}
      </div>

      {/* Selected count */}
      {selected.length > 0 && (
        <p className="text-xs text-brand-600 font-medium">
          {selected.length} composant{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}
        </p>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong py-8 text-center">
          <p className="text-sm text-content-subtle">Aucun composant compatible avec ce type de vélo.</p>
          <p className="mt-1 text-xs text-content-subtle">
            Associez des composants à ce vélo depuis la Bibliothèque.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {filtered.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => onToggle(c.id)}
                className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-content truncate">{c.name}</p>
                <p className="text-xs text-content-muted">
                  {c.category.name}
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
