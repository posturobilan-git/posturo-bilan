"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { EyeIcon, EyeOffIcon, TrashIcon } from "@/components/ui/icons";
import { toast } from "@/lib/stores/toastStore";
import {
  createExerciseCategory,
  updateExerciseCategory,
  deleteExerciseCategory,
  toggleExerciseCategory,
  reorderExerciseCategories,
} from "@/actions/exerciseCategory.actions";

export interface ExerciseCategoryRow {
  id: string;
  name: string;
  isActive: boolean;
  exerciseCount: number;
}

/** A pending « réaffecter puis supprimer » on a category that still has exercises. */
interface Reassign {
  id: string;
  targetId: string;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

export function ExerciseCategoryManagerModal({ categories }: { categories: ExerciseCategoryRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ExerciseCategoryRow[]>(categories);
  const [newName, setNewName] = useState("");
  const [reassign, setReassign] = useState<Reassign | null>(null);
  const [pending, startTransition] = useTransition();

  // Resync local state whenever the modal is (re)opened with fresh server data.
  function openModal() {
    setItems(categories);
    setNewName("");
    setReassign(null);
    setOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createExerciseCategory({ name });
      if (!result.ok) return toast.error(result.error);
      setItems((prev) => [...prev, { id: result.data.id, name, isActive: true, exerciseCount: 0 }]);
      setNewName("");
      toast.success("Catégorie créée.");
      refresh();
    });
  }

  function handleRename(category: ExerciseCategoryRow, input: HTMLInputElement) {
    const name = input.value.trim();
    if (!name || name === category.name) {
      input.value = category.name;
      return;
    }
    startTransition(async () => {
      const result = await updateExerciseCategory(category.id, { name });
      if (!result.ok) {
        input.value = category.name; // refusée (nom déjà pris…) : on remet l'ancien nom
        return toast.error(result.error);
      }
      setItems((prev) => prev.map((c) => (c.id === category.id ? { ...c, name } : c)));
      toast.success("Catégorie renommée.");
      refresh();
    });
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      const result = await toggleExerciseCategory(id);
      if (!result.ok) return toast.error(result.error);
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: result.data.isActive } : c)));
      toast.success(result.data.isActive ? "Catégorie activée." : "Catégorie désactivée.");
      refresh();
    });
  }

  function move(id: string, delta: -1 | 1) {
    const i = items.findIndex((c) => c.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= items.length) return;
    const previous = items;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    startTransition(async () => {
      const result = await reorderExerciseCategories(next.map((c) => c.id));
      if (!result.ok) {
        setItems(previous);
        return toast.error(result.error);
      }
      refresh();
    });
  }

  /** Other ACTIVE categories an exercise can be moved to when `id` is deleted. */
  function reassignTargets(id: string) {
    return items.filter((c) => c.id !== id && c.isActive);
  }

  function startReassign(id: string) {
    setReassign({ id, targetId: reassignTargets(id)[0]?.id ?? "" });
  }

  function confirmReassign() {
    if (!reassign?.targetId) return;
    const { id, targetId } = reassign;
    startTransition(async () => {
      const result = await deleteExerciseCategory(id, targetId);
      if (!result.ok) return toast.error(result.error);
      const moved = result.data.reassigned;
      setItems((prev) =>
        prev
          .filter((c) => c.id !== id)
          .map((c) => (c.id === targetId ? { ...c, exerciseCount: c.exerciseCount + moved } : c))
      );
      setReassign(null);
      toast.success(`Catégorie supprimée — ${plural(moved, "exercice")} réaffecté${moved > 1 ? "s" : ""}.`);
      refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={openModal}>Gérer les catégories</Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-content">Catégories d&apos;exercices</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-content-subtle hover:bg-surface-muted" aria-label="Fermer">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-content-muted">
                Ces catégories classent les exercices de la bibliothèque (Souplesse, Renforcement…).
                L&apos;ordre ci-dessous est l&apos;ordre d&apos;affichage. Une catégorie désactivée
                n&apos;est plus proposée pour un nouvel exercice ; ceux qui y sont déjà restent utilisables.
              </p>

              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border-strong py-6 text-center text-sm text-content-subtle">
                  Aucune catégorie pour le moment.
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((c, i) => {
                    const targets = reassign?.id === c.id ? reassignTargets(c.id) : [];
                    return (
                      <li
                        key={c.id}
                        className={`rounded-lg border border-border bg-surface ${!c.isActive ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center gap-2 px-3 py-2">
                          <div className="flex shrink-0 flex-col">
                            <button
                              onClick={() => move(c.id, -1)}
                              disabled={i === 0 || pending}
                              aria-label={`Monter ${c.name}`}
                              className="text-content-subtle transition-colors hover:text-content disabled:opacity-30"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => move(c.id, 1)}
                              disabled={i === items.length - 1 || pending}
                              aria-label={`Descendre ${c.name}`}
                              className="text-content-subtle transition-colors hover:text-content disabled:opacity-30"
                            >
                              ▼
                            </button>
                          </div>
                          <input
                            defaultValue={c.name}
                            aria-label={`Nom de la catégorie ${c.name}`}
                            maxLength={60}
                            onBlur={(e) => handleRename(c, e.currentTarget)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                            }}
                            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-content focus:border-border-strong focus:bg-surface focus:outline-none"
                          />
                          <span className="shrink-0 text-xs text-content-subtle">
                            {plural(c.exerciseCount, "exercice")}
                          </span>
                          <IconButton
                            icon={c.isActive ? <EyeOffIcon /> : <EyeIcon />}
                            label={c.isActive ? "Désactiver" : "Activer"}
                            onClick={() => handleToggle(c.id)}
                            disabled={pending}
                          />
                          {c.exerciseCount === 0 ? (
                            <DeleteButton
                              onConfirm={async () => {
                                const result = await deleteExerciseCategory(c.id);
                                if (result.ok) {
                                  setItems((prev) => prev.filter((cat) => cat.id !== c.id));
                                  refresh();
                                }
                                return result;
                              }}
                              successMessage="Catégorie supprimée."
                            />
                          ) : (
                            // Des exercices y sont rattachés : on propose de les réaffecter.
                            <IconButton
                              icon={<TrashIcon />}
                              label="Supprimer (réaffecter les exercices)"
                              variant="danger"
                              active={reassign?.id === c.id}
                              onClick={() => (reassign?.id === c.id ? setReassign(null) : startReassign(c.id))}
                              disabled={pending}
                            />
                          )}
                        </div>

                        {reassign?.id === c.id && (
                          <div className="space-y-2 border-t border-border bg-surface-muted px-3 py-3 text-sm">
                            <p className="text-content-muted">
                              {plural(c.exerciseCount, "exercice")} {c.exerciseCount > 1 ? "sont rattachés" : "est rattaché"} à «&nbsp;
                              <strong className="text-content">{c.name}</strong>&nbsp;». Pour la supprimer,
                              réaffectez-{c.exerciseCount > 1 ? "les" : "le"} à une autre catégorie :
                            </p>
                            {targets.length === 0 && (
                              <p className="text-warning-700">
                                Aucune autre catégorie active : créez-en une d&apos;abord, ou désactivez celle-ci.
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              {targets.length > 0 && (
                                <>
                                  <select
                                    value={reassign.targetId}
                                    onChange={(e) => setReassign({ id: c.id, targetId: e.target.value })}
                                    aria-label="Catégorie de destination"
                                    className="min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm text-content focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                  >
                                    {targets.map((t) => (
                                      <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                  </select>
                                  <Button size="sm" variant="danger" onClick={confirmReassign} loading={pending}>
                                    Réaffecter et supprimer
                                  </Button>
                                </>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => setReassign(null)} disabled={pending}>
                                Annuler
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex gap-2 border-t border-border pt-4">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
                  }}
                  maxLength={60}
                  placeholder="Nouvelle catégorie (ex : Étirements)"
                  className="flex-1 rounded-md border border-border-strong px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <Button onClick={handleAdd} loading={pending} disabled={!newName.trim()}>Ajouter</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
