"use client";

import { useState, useTransition } from "react";
import { setBikeTypeMeasurements } from "@/actions/bikeType.actions";
import { toast } from "@/lib/stores/toastStore";

interface Cote {
  id: string;
  name: string;
  unit: string;
}

interface Props {
  bikeTypeId: string;
  /** Common trunk côtes — always applied, shown pinned & non-editable. */
  common: Cote[];
  initialAssigned: Cote[];
  initialAvailable: Cote[];
  canEdit: boolean;
}

type Column = "available" | "assigned";

function byName(a: Cote, b: Cote) {
  return a.name.localeCompare(b.name);
}

export function BikeTypeConfigurator({
  bikeTypeId,
  common,
  initialAssigned,
  initialAvailable,
  canEdit,
}: Props) {
  const [assigned, setAssigned] = useState<Cote[]>(initialAssigned);
  const [available, setAvailable] = useState<Cote[]>(initialAvailable);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<Column | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  /** Persists the given assignment order, reverting local state on failure. */
  function persist(nextAssigned: Cote[], nextAvailable: Cote[]) {
    const prevAssigned = assigned;
    const prevAvailable = available;
    setAssigned(nextAssigned);
    setAvailable(nextAvailable);
    startSave(async () => {
      const result = await setBikeTypeMeasurements(bikeTypeId, nextAssigned.map((c) => c.id));
      if (!result.ok) {
        setAssigned(prevAssigned);
        setAvailable(prevAvailable);
        toast.error(result.error);
      }
    });
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  function add(id: string) {
    const cote = available.find((c) => c.id === id);
    if (!cote) return;
    persist([...assigned, cote], available.filter((c) => c.id !== id));
  }

  function remove(id: string) {
    const cote = assigned.find((c) => c.id === id);
    if (!cote) return;
    persist(assigned.filter((c) => c.id !== id), [...available, cote].sort(byName));
  }

  function move(id: string, delta: -1 | 1) {
    const i = assigned.findIndex((c) => c.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= assigned.length) return;
    const next = [...assigned];
    [next[i], next[j]] = [next[j], next[i]];
    persist(next, available);
  }

  /** Drops the dragged côte into the assigned column at `targetId` (or the end). */
  function dropOnAssigned(targetId: string | null) {
    if (!dragId) return;

    if (dragFrom === "available") {
      const cote = available.find((c) => c.id === dragId);
      if (!cote) return;
      const next = [...assigned];
      const at = targetId ? next.findIndex((c) => c.id === targetId) : next.length;
      next.splice(at < 0 ? next.length : at, 0, cote);
      persist(next, available.filter((c) => c.id !== dragId));
    } else {
      // Reorder within assigned.
      const from = assigned.findIndex((c) => c.id === dragId);
      if (from < 0) return;
      const next = [...assigned];
      const [cote] = next.splice(from, 1);
      const at = targetId ? next.findIndex((c) => c.id === targetId) : next.length;
      next.splice(at < 0 ? next.length : at, 0, cote);
      persist(next, available);
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

  // ── Drag handlers (disabled when read-only) ─────────────────────────────────

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
    <div>
      {!canEdit && (
        <p className="mb-4 rounded-lg bg-surface-muted px-4 py-2 text-sm text-content-muted">
          Lecture seule — seuls les administrateurs peuvent modifier la configuration.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── Available ── */}
        <section
          onDragOver={(e) => canEdit && e.preventDefault()}
          onDrop={() => canEdit && dropOnAvailable()}
          className="flex flex-col rounded-xl border border-border bg-surface"
        >
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-content">Côtes disponibles</h2>
            <p className="text-xs text-content-muted">Bibliothèque complète — glissez ou ajoutez à droite.</p>
          </header>
          <ul className="flex-1 space-y-2 p-3">
            {available.length === 0 ? (
              <li className="py-6 text-center text-sm text-content-subtle">Toutes les côtes sont affectées.</li>
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
                    {c.name} <span className="text-content-subtle">({c.unit})</span>
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => add(c.id)}
                      disabled={saving}
                      aria-label={`Ajouter ${c.name}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-strong text-content-muted transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                    >
                      +
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>

        {/* ── Assigned (+ common pinned) ── */}
        <section
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
            <h2 className="text-sm font-semibold text-content">Côtes de cette étude</h2>
            <p className="text-xs text-content-muted">L&apos;ordre ci-dessous est l&apos;ordre d&apos;affichage du formulaire.</p>
          </header>

          <div className="flex-1 space-y-2 p-3">
            {/* Common trunk — always present, not editable */}
            {common.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-accent-500/40 bg-accent-50/50 px-3 py-2"
              >
                <span className="text-sm text-content">
                  {c.name} <span className="text-content-subtle">({c.unit})</span>
                </span>
                <span className="shrink-0 rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700">
                  Tronc commun
                </span>
              </div>
            ))}

            {assigned.length === 0 && (
              <p className="py-6 text-center text-sm text-content-subtle">
                Glissez des côtes ici ou utilisez le bouton +.
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
                  {c.name} <span className="text-content-subtle">({c.unit})</span>
                </span>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => move(c.id, -1)}
                      disabled={saving || i === 0}
                      aria-label={`Monter ${c.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border-strong text-content-muted transition-colors hover:bg-surface-muted disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => move(c.id, 1)}
                      disabled={saving || i === assigned.length - 1}
                      aria-label={`Descendre ${c.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border-strong text-content-muted transition-colors hover:bg-surface-muted disabled:opacity-30"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      disabled={saving}
                      aria-label={`Retirer ${c.name}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border-strong text-content-muted transition-colors hover:bg-danger-50 hover:text-danger-700 disabled:opacity-50"
                    >
                      −
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
