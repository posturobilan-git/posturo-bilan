import { COMPONENT_CATEGORY_LABELS } from "@/lib/labels";
import type { TopItem } from "@/lib/stats";
import type { ComponentCategory } from "@prisma/client";

export function ComponentsTable({ items }: { items: TopItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-content-subtle">Aucun composant utilisé.</p>;
  }

  return (
    <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-border text-sm">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">#</th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Composant</th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Catégorie</th>
          <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Utilisations</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {items.map((c, i) => (
          <tr key={c.id}>
            <td className="px-4 py-2.5 text-content-subtle">{i + 1}</td>
            <td className="px-4 py-2.5">
              <span className="font-medium text-content">{c.name}</span>
              {c.brand && <span className="text-content-subtle"> · {c.brand}</span>}
            </td>
            <td className="px-4 py-2.5">
              <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-accent-700">
                {COMPONENT_CATEGORY_LABELS[c.category as ComponentCategory] ?? c.category}
              </span>
            </td>
            <td className="px-4 py-2.5 text-right font-semibold text-content">{c.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
