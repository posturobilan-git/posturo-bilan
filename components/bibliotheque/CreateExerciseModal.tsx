"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createExercise, updateExercise } from "@/actions/exercise.actions";
import { toast } from "@/lib/stores/toastStore";
import { EXERCISE_CATEGORIES, EXERCISE_CATEGORY_LABELS } from "@/lib/labels";
import type { Exercise, ExerciseCategory } from "@prisma/client";

export function CreateExerciseModal({ exercise }: { exercise?: Exercise }) {
  const isEdit = Boolean(exercise);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      description: String(fd.get("description") ?? ""),
      category: String(fd.get("category") ?? "AUTRE") as ExerciseCategory,
      frequency: (fd.get("frequency") as string) || undefined,
      duration: (fd.get("duration") as string) || undefined,
      mediaUrl: (fd.get("mediaUrl") as string) || undefined,
    };

    setError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateExercise(exercise!.id, payload)
        : await createExercise(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isEdit ? "Exercice modifié." : "Exercice créé.");
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
        <Button className="w-full sm:w-auto" onClick={() => { setError(null); setOpen(true); }}>+ Nouvel exercice</Button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {isEdit ? "Modifier l'exercice" : "Nouvel exercice"}
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
                <input name="name" required defaultValue={exercise?.name}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-700">Description <span className="text-red-500">*</span></span>
                <textarea name="description" required rows={3} defaultValue={exercise?.description}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">Catégorie</span>
                  <select name="category" defaultValue={exercise?.category ?? "AUTRE"}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                    {EXERCISE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{EXERCISE_CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">Fréquence</span>
                  <input name="frequency" defaultValue={exercise?.frequency ?? ""} placeholder="2×/jour"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">Durée</span>
                  <input name="duration" defaultValue={exercise?.duration ?? ""} placeholder="3 séries de 10"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-gray-700">Lien média</span>
                  <input name="mediaUrl" type="url" defaultValue={exercise?.mediaUrl ?? ""} placeholder="https://…"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                </label>
              </div>

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
