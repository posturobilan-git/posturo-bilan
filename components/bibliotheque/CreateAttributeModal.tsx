"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { toast } from "@/lib/stores/toastStore";
import { createComponentAttribute, updateComponentAttribute } from "@/actions/componentAttribute.actions";
import { COMPONENT_ATTRIBUTE_TYPES, COMPONENT_ATTRIBUTE_TYPE_LABELS } from "@/lib/labels";
import type { AttributeRow } from "./AttributeManagerModal";
import type { ComponentAttributeType } from "@prisma/client";

function slugify(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

interface Props {
  categoryId: string;
  attribute?: AttributeRow;
  onClose: () => void;
  onSaved: (row: AttributeRow) => void;
}

export function CreateAttributeModal({ categoryId, attribute, onClose, onSaved }: Props) {
  const isEdit = Boolean(attribute);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(attribute?.name ?? "");
  const [key, setKey] = useState(attribute?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(isEdit);
  const [type, setType] = useState<ComponentAttributeType>(attribute?.type ?? "TEXT");
  const [unit, setUnit] = useState(attribute?.unit ?? "");
  const [optionsText, setOptionsText] = useState((attribute?.options ?? []).join(", "));
  const [isRequired, setIsRequired] = useState(attribute?.isRequired ?? false);

  function handleNameChange(value: string) {
    setName(value);
    if (!keyTouched) setKey(slugify(value));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const options = optionsText.split(",").map((o) => o.trim()).filter(Boolean);
    const payload = {
      name: name.trim(),
      key: key.trim() || slugify(name),
      type,
      unit: type === "NUMBER" ? unit.trim() || undefined : undefined,
      options: type === "SELECT" ? options : [],
      isRequired,
    };

    setError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateComponentAttribute(attribute!.id, categoryId, payload)
        : await createComponentAttribute(categoryId, payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isEdit ? "Attribut modifié." : "Attribut créé.");
      onSaved({
        id: result.data.id,
        name: payload.name,
        key: payload.key,
        type: payload.type,
        unit: payload.unit ?? null,
        options: payload.options,
        isRequired: payload.isRequired,
        isActive: attribute?.isActive ?? true,
        valueCount: attribute?.valueCount ?? 0,
      });
    });
  }

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-xl">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-content">
              {isEdit ? "Modifier l'attribut" : "Nouvel attribut"}
            </h2>
            <button onClick={onClose} className="rounded-md p-1 text-content-subtle hover:bg-surface-muted" aria-label="Fermer">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-content">Nom <span className="text-danger-500">*</span></span>
              <input
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Largeur constructeur"
                className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-content">Clé technique <span className="text-danger-500">*</span></span>
              <input
                required
                value={key}
                onChange={(e) => { setKeyTouched(true); setKey(e.target.value); }}
                placeholder="largeur_constructeur"
                className="rounded-md border border-border-strong px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <span className="text-xs text-content-subtle">Utilisée en interne (import/export) — minuscules, chiffres, underscores.</span>
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-content">Type</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ComponentAttributeType)}
                  className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {COMPONENT_ATTRIBUTE_TYPES.map((t) => (
                    <option key={t} value={t}>{COMPONENT_ATTRIBUTE_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </label>
              {type === "NUMBER" && (
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-content">Unité</span>
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="mm, cm, degrés"
                    className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </label>
              )}
            </div>

            {type === "SELECT" && (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-content">Options <span className="text-danger-500">*</span></span>
                <input
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder="Plate, Hamac"
                  className="rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <span className="text-xs text-content-subtle">Séparées par des virgules.</span>
              </label>
            )}

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="h-4 w-4 rounded border-border-strong text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm font-medium text-content">Saisie obligatoire dans le formulaire de composant</span>
            </label>

            {error && <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
              <Button type="submit" loading={pending}>{isEdit ? "Enregistrer" : "Créer"}</Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
