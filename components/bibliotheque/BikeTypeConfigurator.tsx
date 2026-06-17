"use client";

import { useEffect, useState, useTransition, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/stores/toastStore";
import type { ActionResult } from "@/lib/action-result";
import type { ConfigItem } from "@/actions/bikeType.actions";

interface Props {
  title: string;
  subtitle?: string;
  /** Common trunk items — always applied. Reorderable when `saveCommon` is set. */
  common: ConfigItem[];
  initialAssigned: ConfigItem[];
  initialAvailable: ConfigItem[];
  /** Persists the ordered assigned ids (a bound server action). */
  save: (ids: string[]) => Promise<ActionResult<unknown>>;
  /**
   * Persists the GLOBAL order of the common trunk (shared by all bike types).
   * When provided, the common block becomes drag-and-drop reorderable.
   */
  saveCommon?: (ids: string[]) => Promise<ActionResult<unknown>>;
  canEdit: boolean;
}

type Column = "available" | "assigned";

interface Lists {
  assigned: ConfigItem[];
  available: ConfigItem[];
}

function byName(a: ConfigItem, b: ConfigItem) {
  return a.name.localeCompare(b.name);
}

function sameOrder(a: ConfigItem[], b: ConfigItem[]) {
  return a.length === b.length && a.every((item, i) => item.id === b[i].id);
}

function Hint({ hint }: { hint?: string }) {
  if (!hint) return null;
  return <span className="text-content-subtle"> ({hint})</span>;
}

export function BikeTypeConfigurator({
  title,
  subtitle,
  common,
  initialAssigned,
  initialAvailable,
  save,
  saveCommon,
  canEdit,
}: Props) {
  // Toutes les mutations (drag, +/−, réordonnancement) restent locales ;
  // la base n'est touchée qu'une fois, au clic sur « Enregistrer ».
  const [saved, setSaved] = useState<Lists>({ assigned: initialAssigned, available: initialAvailable });
  const [assigned, setAssigned] = useState<ConfigItem[]>(initialAssigned);
  const [available, setAvailable] = useState<ConfigItem[]>(initialAvailable);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<Column | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  // Tronc commun réordonnable (ordre global) — état séparé de la colonne droite.
  const commonEditable = canEdit && Boolean(saveCommon);
  const [savedCommon, setSavedCommon] = useState<ConfigItem[]>(common);
  const [commonItems, setCommonItems] = useState<ConfigItem[]>(common);
  const [commonDragId, setCommonDragId] = useState<string | null>(null);
  const [commonOverId, setCommonOverId] = useState<string | null>(null);

  const assignedDirty = !sameOrder(assigned, saved.assigned);
  const commonDirty = !sameOrder(commonItems, savedCommon);
  const dirty = assignedDirty || commonDirty;

  // Garde-fou navigateur : prévient avant de quitter avec des changements non enregistrés.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function apply(nextAssigned: ConfigItem[], nextAvailable: ConfigItem[]) {
    setAssigned(nextAssigned);
    setAvailable(nextAvailable);
  }

  function handleSave() {
    startSave(async () => {
      if (assignedDirty) {
        const result = await save(assigned.map((c) => c.id));
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setSaved({ assigned, available });
      }
      if (commonDirty && saveCommon) {
        const result = await saveCommon(commonItems.map((c) => c.id));
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setSavedCommon(commonItems);
      }
      toast.success("Configuration enregistrée.");
    });
  }

  function handleCancel() {
    setAssigned(saved.assigned);
    setAvailable(saved.available);
    setCommonItems(savedCommon);
  }

  // ── Réordonnancement du tronc commun (local) ──────────────────────────────

  function moveCommon(id: string, delta: -1 | 1) {
    const i = commonItems.findIndex((c) => c.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= commonItems.length) return;
    const next = [...commonItems];
    [next[i], next[j]] = [next[j], next[i]];
    setCommonItems(next);
  }

  function dropOnCommon(targetId: string | null) {
    if (!commonDragId) return;
    const from = commonItems.findIndex((c) => c.id === commonDragId);
    if (from < 0) return;
    const next = [...commonItems];
    const [item] = next.splice(from, 1);
    const at = targetId ? next.findIndex((c) => c.id === targetId) : next.length;
    next.splice(at < 0 ? next.length : at, 0, item);
    setCommonItems(next);
  }

  const commonDragProps = (id: string) =>
    commonEditable
      ? {
          draggable: true,
          onDragStart: () => setCommonDragId(id),
          onDragEnd: () => {
            setCommonDragId(null);
            setCommonOverId(null);
          },
          onDragOver: (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setCommonOverId(id);
          },
          onDrop: (e: DragEvent) => {
            e.stopPropagation();
            dropOnCommon(id);
          },
        }
      : {};

  // ── Mutations (locales uniquement) ────────────────────────────────────────

  function add(id: string) {
    const item = available.find((c) => c.id === id);
    if (!item) return;
    apply([...assigned, item], available.filter((c) => c.id !== id));
  }

  function remove(id: string) {
    const item = assigned.find((c) => c.id === id);
    if (!item) return;
    apply(assigned.filter((c) => c.id !== id), [...available, item].sort(byName));
  }

  function move(id: string, delta: -1 | 1) {
    const i = assigned.findIndex((c) => c.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= assigned.length) return;
    const next = [...assigned];
    [next[i], next[j]] = [next[j], next[i]];
    apply(next, available);
  }

  /** Drops the dragged item into the assigned column at `targetId` (or the end). */
  function dropOnAssigned(targetId: string | null) {
    if (!dragId) return;

    if (dragFrom === "available") {
      const item = available.find((c) => c.id === dragId);
      if (!item) return;
      const next = [...assigned];
      const at = targetId ? next.findIndex((c) => c.id === targetId) : next.length;
      next.splice(at < 0 ? next.length : at, 0, item);
      apply(next, available.filter((c) => c.id !== dragId));
    } else {
      const from = assigned.findIndex((c) => c.id === dragId);
      if (from < 0) return;
      const next = [...assigned];
      const [item] = next.splice(from, 1);
      const at = targetId ? next.findIndex((c) => c.id === targetId) : next.length;
      next.splice(at < 0 ? next.length : at, 0, item);
      apply(next, available);
    }
  }

  function dropOnAvailable() {
    if (!dragId || dragFrom !== "assigned") return;
    remove(dragId);
  }

  function endDrag() {
    setDragId(null);
    setDragFrom(null);
    setOverId(null);
  }

  const dragProps = (id: string, from: Column) =>
    canEdit
      ? {
          draggable: true,
          onDragStart: () => {
            setDragId(id);
            setDragFrom(from);
          },
          onDragEnd: endDrag,
        }
      : {};

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-content">{title}</h2>
          {subtitle && <p className="text-xs text-content-muted">{subtitle}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── Available ── */}
        <div
          onDragOver={(e) => canEdit && e.preventDefault()}
          onDrop={() => canEdit && dropOnAvailable()}
          className="flex flex-col rounded-xl border border-border bg-surface"
        >
          <header className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-content">Disponibles</h3>
            <p className="text-xs text-content-muted">Bibliothèque complète — glissez ou ajoutez à droite.</p>
          </header>
          <ul className="flex-1 space-y-2 p-3">
            {available.length === 0 ? (
              <li className="py-6 text-center text-sm text-content-subtle">Tout est affecté.</li>
            ) : (
              available.map((c) => (
                <li
                  key={c.id}
                  {...dragProps(c.id, "available")}
                  className={`flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 ${
                    canEdit ? "cursor-grab active:cursor-grabbing" : ""
                  } ${dragId === c.id ? "opacity-40" : ""}`}
                >
                  <span className="text-sm text-content">
                    {c.name}
                    <Hint hint={c.hint} />
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => add(c.id)}
                      aria-label={`Ajouter ${c.name}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-strong text-content-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
                    >
                      +
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>

        {/* ── Assigned (+ common pinned) ── */}
        <div
          onDragOver={(e) => {
            if (canEdit) {
              e.preventDefault();
              setOverId(null);
            }
          }}
          onDrop={() => canEdit && dropOnAssigned(null)}
          className="flex flex-col rounded-xl border border-border bg-surface"
        >
          <header className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-content">De cette étude</h3>
            <p className="text-xs text-content-muted">L&apos;ordre ci-dessous est l&apos;ordre d&apos;affichage du formulaire.</p>
          </header>

          <div className="flex-1 space-y-2 p-3">
            {/* Common trunk — always present. Reorderable (global order) when editable. */}
            {commonItems.map((c, i) => (
              <div
                key={c.id}
                {...commonDragProps(c.id)}
                className={`flex items-center gap-2 rounded-lg border border-dashed bg-accent-50/50 px-3 py-2 ${
                  commonEditable ? "cursor-grab active:cursor-grabbing" : ""
                } ${commonDragId === c.id ? "opacity-40" : ""} ${
                  commonOverId === c.id ? "border-brand-500 ring-2 ring-brand-100" : "border-accent-500/40"
                }`}
              >
                {commonEditable && (
                  <svg className="h-4 w-4 shrink-0 text-accent-700/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
                  </svg>
                )}
                <span className="flex-1 text-sm text-content">
                  {c.name}
                  <Hint hint={c.hint} />
                </span>
                {commonEditable ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => moveCommon(c.id, -1)}
                      disabled={i === 0}
                      aria-label={`Monter ${c.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-accent-500/40 text-accent-700 transition-colors hover:bg-accent-50 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveCommon(c.id, 1)}
                      disabled={i === commonItems.length - 1}
                      aria-label={`Descendre ${c.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-accent-500/40 text-accent-700 transition-colors hover:bg-accent-50 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                ) : (
                  <span className="shrink-0 rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700">
                    Tronc commun
                  </span>
                )}
              </div>
            ))}

            {assigned.length === 0 && (
              <p className="py-6 text-center text-sm text-content-subtle">
                Glissez des éléments ici ou utilisez le bouton +.
              </p>
            )}

            {assigned.map((c, i) => (
              <div
                key={c.id}
                {...dragProps(c.id, "assigned")}
                onDragOver={(e) => {
                  if (canEdit) {
                    e.preventDefault();
                    e.stopPropagation();
                    setOverId(c.id);
                  }
                }}
                onDrop={(e) => {
                  if (canEdit) {
                    e.stopPropagation();
                    dropOnAssigned(c.id);
                  }
                }}
                className={`flex items-center gap-2 rounded-lg border bg-surface px-3 py-2 ${
                  canEdit ? "cursor-grab active:cursor-grabbing" : ""
                } ${dragId === c.id ? "opacity-40" : ""} ${
                  overId === c.id ? "border-brand-500 ring-2 ring-brand-100" : "border-border"
                }`}
              >
                {canEdit && (
                  <svg className="h-4 w-4 shrink-0 text-content-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
                  </svg>
                )}
                <span className="flex-1 text-sm text-content">
                  {c.name}
                  <Hint hint={c.hint} />
                </span>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => move(c.id, -1)}
                      disabled={i === 0}
                      aria-label={`Monter ${c.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border-strong text-content-muted transition-colors hover:bg-surface-muted disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => move(c.id, 1)}
                      disabled={i === assigned.length - 1}
                      aria-label={`Descendre ${c.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border-strong text-content-muted transition-colors hover:bg-surface-muted disabled:opacity-30"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      aria-label={`Retirer ${c.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border-strong text-content-muted transition-colors hover:bg-danger-50 hover:text-danger-700"
                    >
                      −
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Barre d'enregistrement — une seule écriture en base, quand tout est prêt. */}
      {canEdit && (
        <div
          className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
            dirty ? "border-warning-600/40 bg-warning-50" : "border-border bg-surface"
          }`}
        >
          <p className={`text-sm ${dirty ? "font-medium text-warning-700" : "text-content-subtle"}`}>
            {dirty ? "Modifications non enregistrées." : "Configuration à jour."}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={!dirty || saving}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty} loading={saving}>
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
