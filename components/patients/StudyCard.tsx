import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ReportActions } from "@/components/patients/ReportActions";
import { StudyDeleteButton } from "@/components/patients/StudyDeleteButton";
import type { StudyWithLibrary, StudyMeasureValue, MeasurementInfo } from "@/types";

function fmt(value: number | null | undefined, unit: string): string {
  if (value == null) return "—";
  return `${value} ${unit}`;
}

export function StudyCard({
  study,
  patientId,
  canEdit,
  measurementsById,
}: {
  study: StudyWithLibrary;
  patientId: string;
  canEdit: boolean;
  measurementsById: Record<string, MeasurementInfo>;
}) {
  const values = (study.measureValues as StudyMeasureValue[] | null) ?? [];
  // Keep only côtes we can label, ordered by the measurement's display order.
  const rows = values
    .map((v) => ({ value: v, info: measurementsById[v.measurementId] }))
    .filter((r): r is { value: StudyMeasureValue; info: MeasurementInfo } => Boolean(r.info))
    .sort((a, b) => a.info.order - b.info.order || a.info.name.localeCompare(b.info.name));
  // Reports can be generated/sent once the study is finalised.
  const reportable = study.status !== "study_pending";

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="6" cy="17" r="3.5" strokeWidth={1.8} />
              <circle cx="18" cy="17" r="3.5" strokeWidth={1.8} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 17l4-7h5l3 7M10 10l-1.5-3H6.5M13 7h3.5" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-content">{study.bikeType.name}</p>
            <p className="text-xs text-content-subtle">
              {new Date(study.createdAt).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>
        <Badge status={study.status} />
      </div>

      {rows.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Côte</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Avant</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Après</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ value, info }) => (
                <tr key={value.measurementId}>
                  <td className="px-3 py-1.5 text-content">{info.name}</td>
                  <td className="px-3 py-1.5 text-right text-content-muted">{fmt(value.before, info.unit)}</td>
                  <td className="px-3 py-1.5 text-right font-medium text-content">{fmt(value.after, info.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {study.componentsUsed.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-content-subtle">Composants</p>
          <p className="mt-1 text-sm text-content">
            {study.componentsUsed.map((c) => c.name).join(", ")}
          </p>
        </div>
      )}

      {study.exercisesPrescribed.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-content-subtle">Exercices</p>
          <p className="mt-1 text-sm text-content">
            {study.exercisesPrescribed.map((e) => e.name).join(", ")}
          </p>
        </div>
      )}

      {study.observations && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-content-subtle">Observations</p>
          <p className="mt-1 text-sm text-content">{study.observations}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {canEdit && (
          <Link href={`/patients/${patientId}/etude?studyId=${study.id}`}>
            <Button variant="secondary" size="sm">Modifier l&apos;étude</Button>
          </Link>
        )}
        {study.reportUrl && (
          <Link
            href={`/api/reports/${study.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-content-muted transition-colors hover:bg-surface-muted"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            PDF
          </Link>
        )}
        {canEdit && reportable && (
          <ReportActions
            studyId={study.id}
            hasReport={Boolean(study.reportUrl)}
            alreadySent={Boolean(study.reportSentAt)}
          />
        )}
        {canEdit && (
          <span className="ml-auto">
            <StudyDeleteButton studyId={study.id} />
          </span>
        )}
      </div>
    </Card>
  );
}
