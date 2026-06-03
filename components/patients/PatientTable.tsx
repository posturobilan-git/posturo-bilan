import Link from "next/link";
import type { Patient, User } from "@prisma/client";

type PatientRow = Patient & {
  kine: Pick<User, "name">;
  _count: { studies: number };
};

interface PatientTableProps {
  patients: PatientRow[];
  emptyMessage?: string;
}

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function StudyCount({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {count} étude{count !== 1 ? "s" : ""}
    </span>
  );
}

export function PatientTable({ patients, emptyMessage = "Aucun patient trouvé." }: PatientTableProps) {
  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-border-strong bg-surface py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-content-subtle">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
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
        {patients.map((p) => (
          <li key={p.id}>
            <Link
              href={`/patients/${p.id}`}
              className="block rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:bg-surface-muted"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                  {initials(p.firstName, p.lastName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-content">
                    {p.firstName} {p.lastName}
                  </div>
                  <div className="truncate text-sm text-content-muted">{p.email}</div>
                </div>
                <StudyCount count={p._count.studies} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-content-muted">
                <span>{p.kine.name}</span>
                <span>{new Date(p.createdAt).toLocaleDateString("fr-FR")}</span>
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
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">
              Patient
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">
              Kiné
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">
              Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-content-subtle">
              Études
            </th>
            <th className="relative px-6 py-3">
              <span className="sr-only">Voir</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {patients.map((p) => (
            <tr key={p.id} className="group transition-colors hover:bg-surface-muted">
              <td className="whitespace-nowrap px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                    {initials(p.firstName, p.lastName)}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-content">
                      {p.firstName} {p.lastName}
                    </div>
                    <div className="text-sm text-content-muted">{p.email}</div>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-6 py-3.5 text-sm text-content-muted">
                {p.kine.name}
              </td>
              <td className="whitespace-nowrap px-6 py-3.5 text-sm text-content-muted">
                {new Date(p.createdAt).toLocaleDateString("fr-FR")}
              </td>
              <td className="whitespace-nowrap px-6 py-3.5">
                <StudyCount count={p._count.studies} />
              </td>
              <td className="whitespace-nowrap px-6 py-3.5 text-right text-sm font-medium">
                <Link
                  href={`/patients/${p.id}`}
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
