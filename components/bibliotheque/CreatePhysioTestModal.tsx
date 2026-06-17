"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { PencilIcon } from "@/components/ui/icons";
import { createPhysioTest, updatePhysioTest } from "@/actions/physioTest.actions";
import { toast } from "@/lib/stores/toastStore";
import { PHYSIO_OUTPUT_TYPES, PHYSIO_OUTPUT_TYPE_LABELS } from "@/lib/labels";
import type { PhysioOutputType } from "@prisma/client";

interface BikeTypeOption {
  id: string;
  name: string;
}

interface SectionOption {
  id: string;
  name: string;
}

interface PhysioTestValue {
  id: string;
  name: string;
  description: string | null;
  outputType: PhysioOutputType;
  unit: string | null;
  isCommon: boolean;
  isRequired: boolean;
  sectionId: string | null;
  bikeTypes: { id: string; name: string }[];
}

export function CreatePhysioTestModal({
  physioTest,
  bikeTypes,
  sections,
}: {
  physioTest?: PhysioTestValue;
  bikeTypes: BikeTypeOption[];
  sections: SectionOption[];
}) {
  const isEdit = Boolean(physioTest);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [outputType, setOutputType] = useState<PhysioOutputType>(physioTest?.outputType ?? "VALUE");
  const [isCommon, setIsCommon] = useState(physioTest?.isCommon ?? false);
  const [isRequired, setIsRequired] = useState(physioTest?.isRequired ?? false);
  const [sectionId, setSectionId] = useState<string>(physioTest?.sectionId ?? "");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    physioTest?.bikeTypes.map((b) => b.id) ?? []
  );

  function toggleType(id: string) {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function reset() {
    setError(null);
    setOutputType(physioTest?.outputType ?? "VALUE");
    setIsCommon(physioTest?.isCommon ?? false);
    setIsRequired(physioTest?.isRequired ?? false);
    setSectionId(physioTest?.sectionId ?? "");
    setSelectedTypes(physioTest?.bikeTypes.map((b) => b.id) ?? []);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim() || undefined,
      outputType,
      unit: outputType === "VALUE" ? String(fd.get("unit") ?? "").trim() : undefined,
      isCommon,
      isRequired,
      sectionId: sectionId || null,
      bikeTypeIds: isCommon ? [] : selectedTypes,
    };

    setError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updatePhysioTest(physioTest!.id, payload)
        : await createPhysioTest(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isEdit ? "Test physio modifié." : "Test physio créé.");
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
          onClick={() => { reset(); setOpen(true); }}
        />
      ) : (
        <Button className="w-full sm:w-auto" onClick={() => { reset(); setOpen(true); }}>+ Nouveau test</Button>
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
                {isEdit ? "Modifier le test physio" : "Nouveau test physio"}
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
                <input name="name" required defaultValue={physioTest?.name} placeholder="Test de flexibilité"
                  className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-content">Description</span>
                <textarea name="description" rows={2} defaultValue={physioTest?.description ?? ""} placeholder="Protocole, repères…"
                  className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-content">Type de résultat</span>
                  <select
                    value={outputType}
                    onChange={(e) => setOutputType(e.target.value as PhysioOutputType)}
                    className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {PHYSIO_OUTPUT_TYPES.map((t) => (
                      <option key={t} value={t}>{PHYSIO_OUTPUT_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </label>
                {outputType === "VALUE" && (
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-content">Unité <span className="text-danger-500">*</span></span>
                    <input name="unit" defaultValue={physioTest?.unit ?? ""} placeholder="cm, °, mm"
                      className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  </label>
                )}
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-content">Section</span>
                <select
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Aucune section</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm font-medium text-content">Saisie obligatoire dans l&apos;étude</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isCommon}
                  onChange={(e) => setIsCommon(e.target.checked)}
                  className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm font-medium text-content">Tronc commun (s&apos;applique à tous les types de vélo)</span>
              </label>

              {!isCommon && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-content">Types de vélo concernés</span>
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
