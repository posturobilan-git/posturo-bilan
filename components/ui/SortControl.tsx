"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface Option {
  field: string;
  label: string;
}

interface Props {
  /** Sortable fields offered for card grids that have no column headers. */
  options: Option[];
  activeSort: string;
  activeDir: "asc" | "desc";
}

/**
 * Sort control for card-grid views (exercices, composants) where there are no
 * table headers to click. Mirrors SortableHeader's URL contract (`sort`/`dir`).
 */
export function SortControl({ options, activeSort, activeDir }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(next: { sort?: string; dir?: "asc" | "desc" }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.sort) params.set("sort", next.sort);
    if (next.dir) params.set("dir", next.dir);
    params.delete("page");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 text-sm text-content-muted">
        <span className="hidden sm:inline">Trier</span>
        <select
          value={activeSort}
          onChange={(e) => update({ sort: e.target.value })}
          disabled={pending}
          className="h-10 rounded-lg border border-border-strong bg-surface px-2 text-sm text-content focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          {options.map((o) => (
            <option key={o.field} value={o.field}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={() => update({ dir: activeDir === "asc" ? "desc" : "asc" })}
        disabled={pending}
        aria-label={activeDir === "asc" ? "Ordre croissant" : "Ordre décroissant"}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong bg-surface text-content-muted transition-colors hover:bg-surface-muted"
      >
        {activeDir === "asc" ? "▲" : "▼"}
      </button>
    </div>
  );
}
