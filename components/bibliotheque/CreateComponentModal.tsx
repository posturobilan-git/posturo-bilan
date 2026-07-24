"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { PencilIcon } from "@/components/ui/icons";
import { createComponent, updateComponent } from "@/actions/component.actions";
import { toast } from "@/lib/stores/toastStore";
import type { BikeComponent, ComponentAttribute } from "@prisma/client";

interface BikeTypeOption {
  id: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

type ComponentValue = BikeComponent & {
  bikeTypes?: { id: string; name: string }[];
  attributeValues?: Array<{
    attributeId: string;
    valueText: string | null;
    valueNumber: number | null;
    valueBoolean: boolean | null;
  }>;
};

/** Raw wire format shared with the server: number → numeric string, boolean →
 * "true"/"false", text/select → the text itself. */
function initialAttributeValues(component?: ComponentValue): Record<string, string> {
  const map: Record<string, string> = {};
  for (const v of component?.attributeValues ?? []) {
    if (v.valueNumber != null) map[v.attributeId] = String(v.valueNumber);
    else if (v.valueBoolean != null) map[v.attributeId] = String(v.valueBoolean);
    else if (v.valueText != null) map[v.attributeId] = v.valueText;
  }
  return map;
}

export function CreateComponentModal({
  component,
  bikeTypes,
  categories,
  attributesByCategory,
}: {
  component?: ComponentValue;
  bikeTypes: BikeTypeOption[];
  categories: CategoryOption[];
  attributesByCategory: Record<string, ComponentAttribute[]>;
}) {
  const isEdit = Boolean(component);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    component?.bikeTypes?.map((b) => b.id) ?? []
  );
  const [categoryId, setCategoryId] = useState<string>(component?.categoryId ?? categories[0]?.id ?? "");
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>(() =>
    initialAttributeValues(component)
  );

  const activeAttributes = attributesByCategory[categoryId] ?? [];
  const categoryLabel = categories.find((c) => c.id === categoryId)?.name;

  function toggleType(id: string) {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function setAttrValue(attributeId: string, value: string) {
    setAttributeValues((prev) => ({ ...prev, [attributeId]: value }));
  }

  function handleCategoryChange(next: string) {
    setCategoryId(next);
    // Les attributs sont scoped par catégorie : en changer les rend obsolètes.
    // Si l'admin revient à la catégorie d'origine du composant, on restaure ses
    // valeurs d'origine plutôt que de les perdre.
    setAttributeValues(next === component?.categoryId ? initialAttributeValues(component) : {});
  }

  function openModal() {
    setError(null);
    setSelectedTypes(component?.bikeTypes?.map((b) => b.id) ?? []);
    setCategoryId(component?.categoryId ?? categories[0]?.id ?? "");
    setAttributeValues(initialAttributeValues(component));
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      brand: (fd.get("brand") as string) || undefined,
      model: (fd.get("model") as string) || undefined,
      categoryId,
      notes: (fd.get("notes") as string) || undefined,
      bikeTypeIds: selectedTypes,
      attributeValues: activeAttributes.map((attr) => ({
        attributeId: attr.id,
        value: attributeValues[attr.id] ?? (attr.type === "BOOLEAN" ? "false" : ""),
      })),
    };

    setError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateComponent(component!.id, payload)
        : await createComponent(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isEdit ? "Composant modifié." : "Composant créé.");
      setOpen(false);
    });
  }

  return (
    <>
      {isEdit ? (
        <IconButton icon={<PencilIcon />} label="Modifier" variant="brand" onClick={openModal} />
      ) : (
        <Button className="w-full sm:w-auto" onClick={openModal}>+ Nouveau composant</Button>
      )}

      {open && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-content">
                {isEdit ? "Modifier le composant" : "Nouveau composant"}
              </h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-content-subtle hover:bg-surface-muted" aria-label="Fermer">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-content">Nom <span className="text-danger-500">*</span></span>
                <input name="name" required defaultValue={component?.name}
                  className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-content">Marque</span>
                  <input name="brand" defaultValue={component?.brand ?? ""} placeholder="Fizik"
                    className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-content">Modèle</span>
                  <input name="model" defaultValue={component?.model ?? ""} placeholder="Arione R3"
                    className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-content">Catégorie</span>
                <select
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-content">Notes</span>
                <textarea name="notes" rows={2} defaultValue={component?.notes ?? ""}
                  className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </label>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-content">
                  Types de vélo compatibles
                  <span className="ml-1 font-normal text-content-subtle">(aucun = universel)</span>
                </span>
                {bikeTypes.length === 0 ? (
                  <p className="text-xs text-content-subtle">Aucun type de vélo actif.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {bikeTypes.map((bt) => {
                      const active = selectedTypes.includes(bt.id);
                      return (
                        <button
                          type="button"
                          key={bt.id}
                          onClick={() => toggleType(bt.id)}
                          aria-pressed={active}
                          className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                            active
                              ? "border-brand-500 bg-brand-50 text-brand-700"
                              : "border-border-strong text-content-muted hover:bg-surface-muted"
                          }`}
                        >
                          {bt.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {activeAttributes.length > 0 && (
                <div className="space-y-3 border-t border-border pt-4">
                  <span className="text-sm font-medium text-content">
                    Attributs{categoryLabel ? ` — ${categoryLabel}` : ""}
                  </span>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {activeAttributes.map((attr) => {
                      const raw = attributeValues[attr.id] ?? (attr.type === "BOOLEAN" ? "false" : "");
                      const labelNode = (
                        <span className="text-sm font-medium text-content">
                          {attr.name}
                          {attr.isRequired && <span className="ml-1 text-danger-500">*</span>}
                        </span>
                      );

                      if (attr.type === "BOOLEAN") {
                        return (
                          <label key={attr.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={raw === "true"}
                              onChange={(e) => setAttrValue(attr.id, String(e.target.checked))}
                              className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
                            />
                            {labelNode}
                          </label>
                        );
                      }

                      if (attr.type === "SELECT") {
                        return (
                          <label key={attr.id} className="flex flex-col gap-1">
                            {labelNode}
                            <select
                              value={raw}
                              onChange={(e) => setAttrValue(attr.id, e.target.value)}
                              className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            >
                              <option value="">—</option>
                              {attr.options.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </label>
                        );
                      }

                      return (
                        <label key={attr.id} className="flex flex-col gap-1">
                          {labelNode}
                          <div className="flex items-center gap-2">
                            <input
                              type={attr.type === "NUMBER" ? "number" : "text"}
                              step={attr.type === "NUMBER" ? "any" : undefined}
                              value={raw}
                              onChange={(e) => setAttrValue(attr.id, e.target.value)}
                              className="w-full rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                            {attr.unit && <span className="shrink-0 text-sm text-content-subtle">{attr.unit}</span>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {error && <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
                <Button type="submit" loading={pending}>{isEdit ? "Enregistrer" : "Créer"}</Button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}
