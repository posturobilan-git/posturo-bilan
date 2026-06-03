"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { PencilIcon } from "@/components/ui/icons";
import { createBikeType, updateBikeType } from "@/actions/bikeType.actions";
import { toast } from "@/lib/stores/toastStore";
import type { BikeType } from "@prisma/client";

export function CreateBikeTypeModal({ bikeType }: { bikeType?: BikeType }) {
  const isEdit = Boolean(bikeType);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = { name: String(fd.get("name") ?? "").trim() };

    setError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateBikeType(bikeType!.id, payload)
        : await createBikeType(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isEdit ? "Type de vélo modifié." : "Type de vélo créé.");
      setOpen(false);
    });
  }

  return (
    <>
      {isEdit ? (
        <IconButton
          icon={<PencilIcon />}
          label="Modifier"
          variant="brand"
          onClick={() => { setError(null); setOpen(true); }}
        />
      ) : (
        <Button className="w-full sm:w-auto" onClick={() => { setError(null); setOpen(true); }}>+ Nouveau type de vélo</Button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {isEdit ? "Modifier le type de vélo" : "Nouveau type de vélo"}
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
                <input name="name" required defaultValue={bikeType?.name} placeholder="Route, VTT, Gravel…"
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
