"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { PER_PAGE_OPTIONS } from "@/lib/pagination";

interface Props {
  total: number;
  page: number;
  perPage: number;
}

/** Builds the compact list of page numbers to show, with `null` as an ellipsis. */
function pageList(current: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push(null);
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pagination({ total, page, perPage }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(page, totalPages);

  function go(params: URLSearchParams) {
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function setPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    go(params);
  }

  function setPerPage(value: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("perPage", String(value));
    params.delete("page"); // back to first page when page size changes
    go(params);
  }

  const from = total === 0 ? 0 : (current - 1) * perPage + 1;
  const to = Math.min(current * perPage, total);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 text-sm text-content-muted">
        <span>
          {from}–{to} sur {total}
        </span>
        <label className="flex items-center gap-1.5">
          <span className="sr-only sm:not-sr-only">Par page</span>
          <select
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
            disabled={pending}
            className="h-8 rounded-md border border-border-strong bg-surface px-2 text-sm text-content focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          onClick={() => setPage(current - 1)}
          disabled={current <= 1 || pending}
          className="flex h-8 items-center rounded-md border border-border-strong bg-surface px-2.5 text-sm font-medium text-content-muted transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Précédent
        </button>

        {pageList(current, totalPages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1.5 text-sm text-content-subtle">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => setPage(p)}
              disabled={pending}
              aria-current={p === current ? "page" : undefined}
              className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors ${
                p === current
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-border-strong bg-surface text-content-muted hover:bg-surface-muted"
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => setPage(current + 1)}
          disabled={current >= totalPages || pending}
          className="flex h-8 items-center rounded-md border border-border-strong bg-surface px-2.5 text-sm font-medium text-content-muted transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          Suivant →
        </button>
      </nav>
    </div>
  );
}
