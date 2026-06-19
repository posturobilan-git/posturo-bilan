"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/stores/toastStore";
import {
  createPhysioTestSection,
  updatePhysioTestSection,
  deletePhysioTestSection,
  reorderPhysioTestSections,
} from "@/actions/physioTestSection.actions";

export interface SectionRow {
  id: string;
  name: string;
  testCount: number;
}

export function SectionsManagerModal({ sections }: { sections: SectionRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SectionRow[]>(sections);
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();

  // Resync local state whenever the modal is (re)opened with fresh server data.
  function openModal() {
    setItems(sections);
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
      const result = await createPhysioTestSection({ name });
      if (!result.ok) return toast.error(result.error);
      setItems((prev) => [...prev, { id: result.data.id, name, testCount: 0 }]);
      setNewName("");
      toast.success("Section créée.");
      refresh();
    });
  }

  function handleRename(id: string, name: string) {
    const trimmed = name.trim();
    const original = sections.find((s) => s.id === id)?.name;
    if (!trimmed || trimmed === original) return;
    startTransition(async () => {
      const result = await updatePhysioTestSection(id, { name: trimmed });
      if (!result.ok) return toast.error(result.error);
      toast.success("Section renommée.");
      refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deletePhysioTestSection(id);
      if (!result.ok) return toast.error(result.error);
      setItems((prev) => prev.filter((s) => s.id !== id));
      toast.success("Section supprimée.");
      refresh();
    });
  }

  function move(id: string, delta: -1 | 1) {
    const i = items.findIndex((s) => s.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    startTransition(async () => {
      const result = await reorderPhysioTestSections(next.map((s) => s.id));
      if (!result.ok) return toast.error(result.error);
      refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" className="w-full sm:w-auto" onClick={openModal}>
        Gérer les sections
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface shadow-2xl sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-content">Sections des tests physio</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-content-subtle hover:bg-surface-muted" aria-label="Fermer">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-content-muted">
                Regroupez les tests par section dans le formulaire d&apos;étude. L&apos;ordre ci-dessous
                est l&apos;ordre d&apos;affichage des groupes.
              </p>

              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border-strong py-6 text-center text-sm text-content-subtle">
                  Aucune section pour le moment.
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                      <div className="flex shrink-0 flex-col">
                        <button
                          onClick={() => move(s.id, -1)}
                          disabled={i === 0 || pending}
                          aria-label={`Monter ${s.name}`}
                          className="text-content-subtle transition-colors hover:text-content disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => move(s.id, 1)}
                          disabled={i === items.length - 1 || pending}
                          aria-label={`Descendre ${s.name}`}
                          className="text-content-subtle transition-colors hover:text-content disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </div>
                      <input
                        defaultValue={s.name}
                        onBlur={(e) => handleRename(s.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-content focus:border-border-strong focus:bg-surface focus:outline-none"
                      />
                      <span className="shrink-0 text-xs text-content-subtle">{s.testCount} test{s.testCount > 1 ? "s" : ""}</span>
                      <button
                        onClick={() => handleDelete(s.id)}
                        disabled={pending}
                        aria-label={`Supprimer ${s.name}`}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-strong text-content-subtle transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-40"
                      >
                        −
                      </button>
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
                  placeholder="Nouvelle section (ex : Genou)"
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
