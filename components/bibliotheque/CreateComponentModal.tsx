"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createComponent, updateComponent } from "@/actions/component.actions";
import { toast } from "@/lib/stores/toastStore";
import { COMPONENT_CATEGORIES, COMPONENT_CATEGORY_LABELS } from "@/lib/labels";
import type { BikeComponent, ComponentCategory } from "@prisma/client";

export function CreateComponentModal({ component }: { component?: BikeComponent }) {
  const isEdit = Boolean(component);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      brand: (fd.get("brand") as string) || undefined,
      model: (fd.get("model") as string) || undefined,
      category: String(fd.get("category") ?? "AUTRE") as ComponentCategory,
      notes: (fd.get("notes") as string) || undefined,
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
        <button
          onClick={() => { setError(null); setOpen(true); }}
          className="text-sm font-medium text-brand-600 hover:text-brand-800"
        >
          Éditer
        </button>
      ) : (
        <Button className="w-full sm:w-auto" onClick={() => { setError(null); setOpen(true); }}>+ Nouveau composant</Button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {isEdit ? "Modifier le composant" : "Nouveau composant"}
              </h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100" aria-label="Fermer">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">Nom <span className="text-red-500">*</span></span>
                <input name="name" required defaultValue={component?.name}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">Marque</span>
                  <input name="brand" defaultValue={component?.brand ?? ""} placeholder="Fizik"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">Modèle</span>
                  <input name="model" defaultValue={component?.model ?? ""} placeholder="Arione R3"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">Catégorie</span>
                <select name="category" defaultValue={component?.category ?? "AUTRE"}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                  {COMPONENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{COMPONENT_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">Notes</span>
                <textarea name="notes" rows={2} defaultValue={component?.notes ?? ""}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </label>

              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
                <Button type="submit" loading={pending}>{isEdit ? "Enregistrer" : "Créer"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
