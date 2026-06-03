"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface Props {
  /** Sort key written to the URL (`sort` param). */
  field: string;
  label: string;
  /** Currently active sort field + direction (from the server-parsed query). */
  activeSort: string;
  activeDir: "asc" | "desc";
  className?: string;
}

/**
 * A clickable table header cell. Clicking toggles asc/desc when already active,
 * otherwise activates this column. The sort state lives in the URL so the link
 * is shareable.
 */
export function SortableHeader({ field, label, activeSort, activeDir, className }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const isActive = activeSort === field;
  const nextDir: "asc" | "desc" = isActive && activeDir === "asc" ? "desc" : "asc";

  function handleClick() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", field);
    params.set("dir", nextDir);
    params.delete("page");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <th className={`px-6 py-3 text-left ${className ?? ""}`}>
      <button
        onClick={handleClick}
        disabled={pending}
        className="group inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-content-subtle transition-colors hover:text-content"
      >
        {label}
        <span className="text-[0.65rem] leading-none">
          {isActive ? (activeDir === "asc" ? "▲" : "▼") : <span className="opacity-0 group-hover:opacity-40">▲</span>}
        </span>
      </button>
    </th>
  );
}
