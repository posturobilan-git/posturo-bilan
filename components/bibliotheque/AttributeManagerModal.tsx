"use client";

import { useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { PencilIcon, EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { toast } from "@/lib/stores/toastStore";
import {
  deleteComponentAttribute,
  reorderComponentAttributes,
  toggleComponentAttribute,
} from "@/actions/componentAttribute.actions";
import { COMPONENT_ATTRIBUTE_TYPE_LABELS } from "@/lib/labels";
import { CreateAttributeModal } from "./CreateAttributeModal";
import type { ComponentAttributeType } from "@prisma/client";

/** Narrow display shape — the page maps ComponentAttributeWithCount → this. */
export interface AttributeRow {
  id: string;
  name: string;
  key: string;
  type: ComponentAttributeType;
  unit: string | null;
  options: string[];
  isRequired: boolean;
  isActive: boolean;
  valueCount: number;
}

interface Props {
  /** null when no specific category is selected (e.g. "Toutes catégories") — the
   * button still renders, disabled, so the feature stays discoverable. */
  categoryId: string | null;
  categoryLabel: string | null;
  attributes: AttributeRow[];
}

export function AttributeManagerModal({ categoryId, categoryLabel, attributes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AttributeRow[]>(attributes);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AttributeRow | null>(null);
  const [, startTransition] = useTransition();

  function openModal() {
    setItems(attributes);
    setOpen(true);
  }

  function persistOrder(next: AttributeRow[]) {
    if (!categoryId) return; // le déclencheur est désactivé sans catégorie
    setItems(next);
    startTransition(async () => {
      const result = await reorderComponentAttributes(categoryId, next.map((a) => a.id));
      if (!result.ok) return toast.error(result.error);
      router.refresh();
    });
  }

  function move(id: string, delta: -1 | 1) {
    const i = items.findIndex((a) => a.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    persistOrder(next);
  }

  function drop(targetId: string | null) {
    if (!dragId) return;
    const from = items.findIndex((a) => a.id === dragId);
    if (from < 0) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    const at = targetId ? next.findIndex((a) => a.id === targetId) : next.length;
    next.splice(at < 0 ? next.length : at, 0, item);
    persistOrder(next);
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      const result = await toggleComponentAttribute(id);
      if (!result.ok) return toast.error(result.error);
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, isActive: result.data.isActive } : a)));
      router.refresh();
    });
  }

  function handleSaved(row: AttributeRow) {
    setItems((prev) =>
      editing ? prev.map((a) => (a.id === row.id ? row : a)) : [...prev, row]
    );
    setCreating(false);
    setEditing(null);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="secondary"
        className="w-full sm:w-auto"
        onClick={openModal}
        disabled={!categoryId}
        title={categoryId ? undefined : "Choisissez d'abord une catégorie de composant ci-dessus."}
      >
        Configurer les attributs{categoryLabel ? ` — ${categoryLabel}` : ""}
      </Button>

      {open && !creating && !editing && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          >
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-xl">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="text-lg font-semibold text-content">Attributs — {categoryLabel}</h2>
                <button onClick={() => setOpen(false)} className="rounded-md p-1 text-content-subtle hover:bg-surface-muted" aria-label="Fermer">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 px-6 py-5">
                <p className="text-sm text-content-muted">
                  Ces attributs apparaissent dans le formulaire de composant et servent de
                  filtres dans la bibliothèque. Glissez pour réordonner.
                </p>

                {items.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border-strong py-6 text-center text-sm text-content-subtle">
                    Aucun attribut pour cette catégorie.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((attr, i) => (
                      <li
                        key={attr.id}
                        draggable
                        onDragStart={() => setDragId(attr.id)}
                        onDragEnd={() => { setDragId(null); setOverId(null); }}
                        onDragOver={(e: DragEvent) => { e.preventDefault(); setOverId(attr.id); }}
                        onDrop={(e: DragEvent) => { e.preventDefault(); drop(attr.id); }}
                        className={`flex items-center gap-2 rounded-lg border bg-surface px-3 py-2 cursor-grab active:cursor-grabbing ${
                          dragId === attr.id ? "opacity-40" : ""
                        } ${overId === attr.id ? "border-brand-500 ring-2 ring-brand-100" : "border-border"} ${
                          !attr.isActive ? "opacity-60" : ""
                        }`}
                      >
                        <svg className="h-4 w-4 shrink-0 text-content-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-content">
                            {attr.name}
                            {attr.isRequired && <span className="ml-1 text-danger-500">*</span>}
                          </p>
                          <p className="truncate text-xs text-content-subtle">
                            {COMPONENT_ATTRIBUTE_TYPE_LABELS[attr.type]}
                            {attr.unit ? ` · ${attr.unit}` : ""}
                            {attr.options.length > 0 ? ` · ${attr.options.join(", ")}` : ""}
                          </p>
                        </div>
                        {!attr.isActive && (
                          <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-xs text-content-muted">
                            Désactivé
                          </span>
                        )}
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => move(attr.id, -1)}
                            disabled={i === 0}
                            aria-label={`Monter ${attr.name}`}
                            className="text-content-subtle transition-colors hover:text-content disabled:opacity-30"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => move(attr.id, 1)}
                            disabled={i === items.length - 1}
                            aria-label={`Descendre ${attr.name}`}
                            className="text-content-subtle transition-colors hover:text-content disabled:opacity-30"
                          >
                            ▼
                          </button>
                          <IconButton
                            icon={attr.isActive ? <EyeOffIcon /> : <EyeIcon />}
                            label={attr.isActive ? "Désactiver" : "Activer"}
                            onClick={() => handleToggle(attr.id)}
                          />
                          <IconButton icon={<PencilIcon />} label="Modifier" variant="brand" onClick={() => setEditing(attr)} />
                          <DeleteButton
                            onConfirm={async () => {
                              const result = await deleteComponentAttribute(attr.id);
                              if (result.ok) {
                                setItems((prev) => prev.filter((a) => a.id !== attr.id));
                                router.refresh();
                              }
                              return result;
                            }}
                            successMessage="Attribut supprimé."
                            warning={attr.valueCount > 0 ? `${attr.valueCount} valeur(s) seront supprimées.` : undefined}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="border-t border-border pt-4">
                  <Button className="w-full sm:w-auto" onClick={() => setCreating(true)}>+ Nouvel attribut</Button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {(creating || editing) && categoryId && (
        <CreateAttributeModal
          categoryId={categoryId}
          attribute={editing ?? undefined}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
