"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface Props {
  /** [value, label] pairs */
  options: [string, string][];
  defaultValue?: string;
}

export function CategoryFilter({ options, defaultValue = "" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) params.set("category", e.target.value);
    else params.delete("category");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <select
      defaultValue={defaultValue}
      onChange={handleChange}
      className="rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      <option value="">Toutes catégories</option>
      {options.map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}
