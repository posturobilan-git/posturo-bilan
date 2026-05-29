import { EXERCISE_CATEGORY_LABELS } from "@/lib/labels";
import type { TopExercise } from "@/lib/stats";
import type { ExerciseCategory } from "@prisma/client";

export function TopExercisesTable({ items }: { items: TopExercise[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-content-subtle">Aucun exercice prescrit.</p>;
  }

  return (
    <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-border text-sm">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">#</th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Exercice</th>
          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Catégorie</th>
          <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Prescriptions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {items.map((e, i) => (
          <tr key={e.id}>
            <td className="px-4 py-2.5 text-content-subtle">{i + 1}</td>
            <td className="px-4 py-2.5 font-medium text-content">{e.name}</td>
            <td className="px-4 py-2.5">
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                {EXERCISE_CATEGORY_LABELS[e.category as ExerciseCategory] ?? e.category}
              </span>
            </td>
            <td className="px-4 py-2.5 text-right font-semibold text-content">{e.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
