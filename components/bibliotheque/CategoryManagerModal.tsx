"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { toast } from "@/lib/stores/toastStore";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategory,
  reorderCategories,
} from "@/actions/componentCategory.actions";

export interface CategoryRow {
  id: string;
  name: string;
  isActive: boolean;
  componentCount: number;
  attributeCount: number;
}

export function CategoryManagerModal({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CategoryRow[]>(categories);
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();

  // Resync local state whenever the modal is (re)opened with fresh server data.
  function openModal() {
    setItems(categories);
    setNewName("");
    setOpen(true);
  }

  function refresh() {
    router.refresh();
  }

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createCategory({ name });
      if (!result.ok) return toast.error(result.error);
      setItems((prev) => [...prev, { id: result.data.id, name, isActive: true, componentCount: 0, attributeCount: 0 }]);
      setNewName("");
      toast.success("Catégorie créée.");
      refresh();
    });
  }

  function handleRename(id: string, name: string) {
    const trimmed = name.trim();
    const original = categories.find((c) => c.id === id)?.name;
    if (!trimmed || trimmed === original) return;
    startTransition(async () => {
      const result = await updateCategory(id, { name: trimmed });
      if (!result.ok) return toast.error(result.error);
      toast.success("Catégorie renommée.");
      refresh();
    });
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      const result = await toggleCategory(id);
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
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    startTransition(async () => {
      const result = await reorderCategories(next.map((c) => c.id));
      if (!result.ok) return toast.error(result.error);
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
              <h2 className="text-lg font-semibold text-content">Catégories de composants</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-content-subtle hover:bg-surface-muted" aria-label="Fermer">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-content-muted">
                Ces catégories organisent la bibliothèque de composants (Selle, Potence...).
                L&apos;ordre ci-dessous est l&apos;ordre d&apos;affichage.
              </p>

              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border-strong py-6 text-center text-sm text-content-subtle">
                  Aucune catégorie pour le moment.
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((c, i) => (
                    <li
                      key={c.id}
                      className={`flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 ${!c.isActive ? "opacity-60" : ""}`}
                    >
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
                        onBlur={(e) => handleRename(c.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-content focus:border-border-strong focus:bg-surface focus:outline-none"
                      />
                      <span className="shrink-0 text-xs text-content-subtle">
                        {c.componentCount} composant{c.componentCount > 1 ? "s" : ""}
                      </span>
                      <IconButton
                        icon={c.isActive ? <EyeOffIcon /> : <EyeIcon />}
                        label={c.isActive ? "Désactiver" : "Activer"}
                        onClick={() => handleToggle(c.id)}
                        disabled={pending}
                      />
                      <DeleteButton
                        onConfirm={async () => {
                          const result = await deleteCategory(c.id);
                          if (result.ok) {
                            setItems((prev) => prev.filter((cat) => cat.id !== c.id));
                            refresh();
                          }
                          return result;
                        }}
                        successMessage="Catégorie supprimée."
                        warning={
                          c.componentCount > 0 || c.attributeCount > 0
                            ? `${c.componentCount} composant(s), ${c.attributeCount} attribut(s).`
                            : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2 border-t border-border pt-4">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
                  }}
                  placeholder="Nouvelle catégorie (ex : Guidoline)"
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
