"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { AttributeFilterOption } from "@/actions/component.actions";

function humanizeOption(value: string): string {
  if (value === "true") return "Oui";
  if (value === "false") return "Non";
  return value;
}

/**
 * Dynamically-generated filter row: one <select> per active NUMBER/BOOLEAN/SELECT
 * attribute of the currently-displayed category, wired to attr_<attributeId>
 * URL params — same router.replace pattern as CategoryFilter, but with a
 * dynamic (not fixed) set of param keys.
 */
export function ComponentAttributeFilters({
  options,
  values,
}: {
  options: AttributeFilterOption[];
  values: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (options.length === 0) return null;

  function handleChange(attributeId: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(`attr_${attributeId}`, value);
    else params.delete(`attr_${attributeId}`);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <>
      {options.map((opt) => (
        <select
          key={opt.attributeId}
          value={values[opt.attributeId] ?? ""}
          onChange={(e) => handleChange(opt.attributeId, e.target.value)}
          className="rounded-md border border-border-strong bg-surface py-2 pl-3 pr-8 text-sm text-content focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">{opt.name}</option>
          {opt.values.map((v) => (
            <option key={v} value={v}>{humanizeOption(v)}</option>
          ))}
        </select>
      ))}
    </>
  );
}
