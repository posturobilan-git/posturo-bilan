"use client";

import { useEffect, useState, useTransition, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/stores/toastStore";
import type { ActionResult } from "@/lib/action-result";
import type { ConfigItem } from "@/actions/bikeType.actions";

interface Props {
  title: string;
  subtitle?: string;
  /**
   * Tout ce qui s'applique à ce type de vélo, dans l'ordre d'affichage du
   * formulaire — tronc commun compris (badge « Commun », jamais retirable).
   */
  initialAssigned: ConfigItem[];
  initialAvailable: ConfigItem[];
  /** Persists the full ordered list of ids (a bound server action). */
  save: (ids: string[]) => Promise<ActionResult<unknown>>;
  canEdit: boolean;
}

type Column = "available" | "assigned";

interface Lists {
  assigned: ConfigItem[];
  available: ConfigItem[];
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const NO_GROUP = "__none__";

function groupKey(c: ConfigItem): string {
  return c.group?.id ?? NO_GROUP;
}

/** Sans regroupement (côtes), tous les éléments sont du même groupe. */
function sameGroup(a: ConfigItem, b: ConfigItem): boolean {
  return groupKey(a) === groupKey(b);
}

function byName(a: ConfigItem, b: ConfigItem) {
  return a.name.localeCompare(b.name);
}

function sameOrder(a: ConfigItem[], b: ConfigItem[]) {
  return a.length === b.length && a.every((item, i) => item.id === b[i].id);
}

/** Index du voisin le plus proche du même groupe, vers le haut (-1) ou le bas (+1) ; -1 s'il n'y en a pas. */
function neighborIndex(list: ConfigItem[], i: number, delta: -1 | 1): number {
  for (let j = i + delta; j >= 0 && j < list.length; j += delta) {
    if (sameGroup(list[i], list[j])) return j;
  }
  return -1;
}

/** Position d'insertion en fin de groupe : après son dernier élément, sinon tout à la fin. */
function endOfGroup(list: ConfigItem[], item: ConfigItem): number {
  for (let j = list.length - 1; j >= 0; j--) {
    if (sameGroup(list[j], item)) return j + 1;
  }
  return list.length;
}

/** Insère `item` avant la ligne `targetId` si elle est du même groupe, sinon en fin de groupe. */
function insertNear(list: ConfigItem[], item: ConfigItem, targetId: string | null): ConfigItem[] {
  const t = targetId ? list.findIndex((c) => c.id === targetId) : -1;
  const at = t >= 0 && sameGroup(list[t], item) ? t : endOfGroup(list, item);
  return [...list.slice(0, at), item, ...list.slice(at)];
}

/** Découpe la liste en groupes (sections), dans l'ordre des sections ; « Sans section » en dernier. */
function splitByGroup(list: ConfigItem[]): { key: string; name: string; items: ConfigItem[] }[] {
  const groups = new Map<string, { key: string; name: string; order: number; items: ConfigItem[] }>();
  for (const c of list) {
    const key = groupKey(c);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: c.group?.name ?? "Sans section",
        order: c.group?.order ?? Number.MAX_SAFE_INTEGER,
        items: [],
      });
    }
    groups.get(key)!.items.push(c);
  }
  return [...groups.values()].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name) || a.key.localeCompare(b.key)
  );
}

// ─── Presentational pieces (module scope: stable identity across renders) ─────

function Hint({ hint }: { hint?: string }) {
  if (!hint) return null;
  return <span className="text-content-subtle"> ({hint})</span>;
}

function DragHandle({ className }: { className: string }) {
  return (
    <svg className={`h-4 w-4 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
    </svg>
  );
}

interface AssignedRowProps {
  item: ConfigItem;
  canEdit: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dragging: boolean;
  over: boolean;
  dragProps: Record<string, unknown>;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}

function AssignedRow({
  item,
  canEdit,
  canMoveUp,
  canMoveDown,
  dragging,
  over,
  dragProps,
  onMove,
  onRemove,
}: AssignedRowProps) {
  const arrow = item.isCommon
    ? "border-accent-500/40 text-accent-700 hover:bg-accent-50"
    : "border-border-strong text-content-muted hover:bg-surface-muted";

  return (
    <div
      {...dragProps}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
        item.isCommon ? "border-dashed bg-accent-50/50" : "bg-surface"
      } ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${dragging ? "opacity-40" : ""} ${
        over ? "border-brand-500 ring-2 ring-brand-100" : item.isCommon ? "border-accent-500/40" : "border-border"
      }`}
    >
      {canEdit && <DragHandle className={item.isCommon ? "text-accent-700/70" : "text-content-subtle"} />}
      <span className="flex-1 text-sm text-content">
        {item.name}
        <Hint hint={item.hint} />
      </span>
      {item.isCommon && (
        <span
          title="Présent sur tous les types de vélo — seule sa position change."
          className="shrink-0 rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700"
        >
          Commun
        </span>
      )}
      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onMove(-1)}
            disabled={!canMoveUp}
            aria-label={`Monter ${item.name}`}
            className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:opacity-30 ${arrow}`}
          >
            ▲
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={!canMoveDown}
            aria-label={`Descendre ${item.name}`}
            className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:opacity-30 ${arrow}`}
          >
            ▼
          </button>
          {!item.isCommon && (
            <button
              onClick={onRemove}
              aria-label={`Retirer ${item.name}`}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border-strong text-content-muted transition-colors hover:bg-danger-50 hover:text-danger-700"
            >
              −
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function BikeTypeConfigurator({
  title,
  subtitle,
  initialAssigned,
  initialAvailable,
  save,
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

  const dirty = !sameOrder(assigned, saved.assigned);

  // Les tests physio sont regroupés par section dans le formulaire : l'ordre ne
  // compte qu'au sein d'une section, et l'écran le montre ainsi.
  const grouped = assigned.some((c) => c.group !== undefined) || available.some((c) => c.group !== undefined);
  const dragged = dragId ? [...assigned, ...available].find((c) => c.id === dragId) : undefined;
  /** Une ligne n'accepte le dépôt que d'un élément de son groupe (ou venant des disponibles). */
  const canDropOn = (c: ConfigItem) => !dragged || dragFrom === "available" || sameGroup(dragged, c);

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
      const result = await save(assigned.map((c) => c.id));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSaved({ assigned, available });
      toast.success("Configuration enregistrée.");
    });
  }

  function handleCancel() {
    setAssigned(saved.assigned);
    setAvailable(saved.available);
  }

  // ── Mutations (locales uniquement) ────────────────────────────────────────

  function add(id: string) {
    const item = available.find((c) => c.id === id);
    if (!item) return;
    apply(insertNear(assigned, item, null), available.filter((c) => c.id !== id));
  }

  function remove(id: string) {
    const item = assigned.find((c) => c.id === id);
    // Le tronc commun reste sur tous les types : on ne le retire jamais.
    if (!item || item.isCommon) return;
    apply(assigned.filter((c) => c.id !== id), [...available, item].sort(byName));
  }

  function move(id: string, delta: -1 | 1) {
    const i = assigned.findIndex((c) => c.id === id);
    const j = i < 0 ? -1 : neighborIndex(assigned, i, delta);
    if (j < 0) return;
    const next = [...assigned];
    [next[i], next[j]] = [next[j], next[i]];
    apply(next, available);
  }

  /** Drops the dragged item into the assigned column at `targetId` (or the end of its group). */
  function dropOnAssigned(targetId: string | null) {
    if (!dragId) return;

    if (dragFrom === "available") {
      const item = available.find((c) => c.id === dragId);
      if (!item) return;
      apply(insertNear(assigned, item, targetId), available.filter((c) => c.id !== dragId));
      return;
    }

    const item = assigned.find((c) => c.id === dragId);
    if (!item || targetId === dragId) return;
    const target = targetId ? assigned.find((c) => c.id === targetId) : undefined;
    if (target && !sameGroup(target, item)) return; // autre section : sans effet
    apply(insertNear(assigned.filter((c) => c.id !== dragId), item, targetId), available);
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

  const assignedDragProps = (c: ConfigItem) => ({
    ...dragProps(c.id, "assigned"),
    ...(canEdit
      ? {
          onDragOver: (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setOverId(canDropOn(c) ? c.id : null);
          },
          onDrop: (e: DragEvent) => {
            e.stopPropagation();
            dropOnAssigned(c.id);
          },
        }
      : {}),
  });

  function renderAssigned(c: ConfigItem) {
    const i = assigned.indexOf(c);
    return (
      <AssignedRow
        key={c.id}
        item={c}
        canEdit={canEdit}
        canMoveUp={neighborIndex(assigned, i, -1) >= 0}
        canMoveDown={neighborIndex(assigned, i, 1) >= 0}
        dragging={dragId === c.id}
        over={overId === c.id}
        dragProps={assignedDragProps(c)}
        onMove={(delta) => move(c.id, delta)}
        onRemove={() => remove(c.id)}
      />
    );
  }

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
                    {grouped && (
                      <span className="text-content-subtle"> · {c.group?.name ?? "Sans section"}</span>
                    )}
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

        {/* ── Assigned: une seule liste ordonnée, tronc commun compris ── */}
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
            <p className="text-xs text-content-muted">
              L&apos;ordre ci-dessous est l&apos;ordre d&apos;affichage du formulaire.
              {grouped && " Il s'applique au sein de chaque section."} Les éléments « Commun » sont
              présents sur tous les types de vélo : seule leur position change.
            </p>
          </header>

          <div className="flex-1 space-y-2 p-3">
            {assigned.length === 0 && (
              <p className="py-6 text-center text-sm text-content-subtle">
                Glissez des éléments ici ou utilisez le bouton +.
              </p>
            )}

            {grouped
              ? splitByGroup(assigned).map((g) => (
                  <div key={g.key} className="space-y-2 pt-1 first:pt-0">
                    <h4 className="px-1 text-xs font-semibold uppercase tracking-wide text-content-subtle">
                      {g.name}
                    </h4>
                    {g.items.map(renderAssigned)}
                  </div>
                ))
              : assigned.map(renderAssigned)}
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
