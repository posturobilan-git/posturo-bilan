"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface Props {
  categories: { id: string; name: string }[];
  selectedId: string | null;
  /** Accessible name of the chip group (« Catégorie de composant », « Catégorie d'exercice »…). */
  ariaLabel: string;
}

/**
 * A row of category chips — clearly a primary selector, not a buried filter.
 * Picking one narrows the list of the current Bibliothèque tab (and, for the
 * Composants tab, scopes "Configurer les attributs" / Export / Import to that
 * category) through the `category` URL param, which holds the category id.
 */
export function CategoryPicker({ categories, selectedId, ariaLabel }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function select(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("category", id);
    else params.delete("category");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  const pillClass = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-brand-500 bg-brand-50 text-brand-700"
        : "border-border-strong text-content-muted hover:bg-surface-muted"
    }`;

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={ariaLabel}>
      <button type="button" onClick={() => select(null)} aria-pressed={!selectedId} className={pillClass(!selectedId)}>
        Toutes catégories
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => select(c.id)}
          aria-pressed={c.id === selectedId}
          className={pillClass(c.id === selectedId)}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
