import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { SortableHeader } from "@/components/ui/SortableHeader";
import type { StudyListItem } from "@/types";
import type { SortDir } from "@/lib/pagination";

interface StudiesTableProps {
  studies: StudyListItem[];
  sort?: string;
  dir?: SortDir;
  emptyMessage?: string;
}

function patientName(p: StudyListItem["patient"]) {
  return p.isAnonymized ? "Patient anonymisé" : `${p.firstName} ${p.lastName}`;
}

export function StudiesTable({
  studies,
  sort = "createdAt",
  dir = "desc",
  emptyMessage = "Aucune étude trouvée.",
}: StudiesTableProps) {
  if (studies.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-border-strong bg-surface py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-content-subtle">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </span>
        <p className="mt-4 max-w-sm text-sm text-content-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile — stacked cards */}
      <ul className="space-y-3 md:hidden">
        {studies.map((s) => (
          <li key={s.id}>
            <Link
              href={`/patients/${s.patient.id}`}
              className="block rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:bg-surface-muted"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-content">{patientName(s.patient)}</span>
                <Badge status={s.status} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-content-muted">
                <span className="font-medium text-content-muted">{s.bikeType.name}</span>
                <span>{new Date(s.createdAt).toLocaleDateString("fr-FR")}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop — table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface shadow-sm md:block">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border bg-surface-muted">
              <SortableHeader field="patient" label="Patient" activeSort={sort} activeDir={dir} />
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Type de vélo</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">Kiné</th>
              <SortableHeader field="createdAt" label="Date" activeSort={sort} activeDir={dir} />
              <SortableHeader field="status" label="Statut" activeSort={sort} activeDir={dir} />
              <th className="relative px-6 py-3"><span className="sr-only">Voir</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {studies.map((s) => (
              <tr key={s.id} className="group transition-colors hover:bg-surface-muted">
                <td className="whitespace-nowrap px-6 py-3.5 text-sm font-medium text-content">
                  {patientName(s.patient)}
                </td>
                <td className="whitespace-nowrap px-6 py-3.5 text-sm text-content-muted">{s.bikeType.name}</td>
                <td className="whitespace-nowrap px-6 py-3.5 text-sm text-content-muted">{s.kine.name}</td>
                <td className="whitespace-nowrap px-6 py-3.5 text-sm text-content-muted">
                  {new Date(s.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="whitespace-nowrap px-6 py-3.5"><Badge status={s.status} /></td>
                <td className="whitespace-nowrap px-6 py-3.5 text-right text-sm font-medium">
                  <Link
                    href={`/patients/${s.patient.id}`}
                    className="text-content-subtle transition-colors group-hover:text-brand-600"
                  >
                    Voir →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
