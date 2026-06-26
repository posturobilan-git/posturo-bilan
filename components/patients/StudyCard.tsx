import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ReportActions } from "@/components/patients/ReportActions";
import { StudyDeleteButton } from "@/components/patients/StudyDeleteButton";
import { MeasureDelta } from "@/components/study/MeasureDelta";
import { PhotoComparison, type ComparePhoto } from "@/components/study/PhotoComparison";
import type {
  StudyWithLibrary,
  StudyMeasureValue,
  StudyRiderMeasureValue,
  MeasurementInfo,
} from "@/types";
import {
  formatPhysioValue,
  hasPhysioValue,
  type PhysioTestInfo,
  type StudyPhysioResult,
} from "@/lib/physio";

function fmt(value: number | null | undefined, unit: string): string {
  if (value == null) return "—";
  return `${value} ${unit}`;
}

export function StudyCard({
  study,
  patientId,
  canEdit,
  measurementsById,
  riderMeasurementsById,
  physioTestsById,
}: {
  study: StudyWithLibrary;
  patientId: string;
  canEdit: boolean;
  measurementsById: Record<string, MeasurementInfo>;
  riderMeasurementsById: Record<string, MeasurementInfo>;
  physioTestsById: Record<string, PhysioTestInfo>;
}) {
  const values = (study.measureValues as StudyMeasureValue[] | null) ?? [];
  // Keep only côtes we can label, ordered alphabetically by name.
  const rows = values
    .map((v) => ({ value: v, info: measurementsById[v.measurementId] }))
    .filter((r): r is { value: StudyMeasureValue; info: MeasurementInfo } => Boolean(r.info))
    .sort((a, b) => a.info.name.localeCompare(b.info.name));

  // Mesures du cycliste — same resolution, with the avant/après/delta layout.
  const riderValues = (study.riderMeasureValues as StudyRiderMeasureValue[] | null) ?? [];
  const riderRows = riderValues
    .map((v) => ({ value: v, info: riderMeasurementsById[v.riderMeasurementId] }))
    .filter((r): r is { value: StudyRiderMeasureValue; info: MeasurementInfo } => Boolean(r.info))
    .sort((a, b) => a.info.name.localeCompare(b.info.name));

  // Same resolution for the physio test results. Keep rows with a value OR a comment.
  const physioResults = (study.physioResults as StudyPhysioResult[] | null) ?? [];
  const physioRows = physioResults
    .filter((r) => hasPhysioValue(r) || Boolean(r.comment?.trim()))
    .map((r) => ({ result: r, info: physioTestsById[r.physioTestId] }))
    .filter((r): r is { result: StudyPhysioResult; info: PhysioTestInfo } => Boolean(r.info))
    .sort((a, b) => a.info.name.localeCompare(b.info.name));
  // Douleurs structurées, déjà ordonnées (order asc) par la requête.
  const pains = study.pains ?? [];
  // Photos avant/après — servies (privément) via /api/photos/[id], déjà ordonnées.
  const toCompare = (phase: "BEFORE" | "AFTER"): ComparePhoto[] =>
    (study.photos ?? [])
      .filter((p) => p.phase === phase)
      .map((p) => ({ src: `/api/photos/${p.id}`, angle: p.angle, caption: p.caption }));
  const beforePhotos = toCompare("BEFORE");
  const afterPhotos = toCompare("AFTER");
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

      {pains.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-content-subtle">Douleurs</p>
          <div className="space-y-2">
            {pains.map((p) => {
              const meta = [
                p.type,
                p.intensity ? `${p.intensity}/10` : null,
                p.restAtRest ? "présente au repos" : null,
                p.activity,
                p.duration,
              ].filter(Boolean);
              return (
                <div key={p.id} className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2">
                  <p className="text-sm font-medium text-content">{p.location}</p>
                  {meta.length > 0 && (
                    <p className="mt-0.5 text-xs text-content-muted">{meta.join(" · ")}</p>
                  )}
                  {(p.aggravatingFactors || p.relievingFactors) && (
                    <p className="mt-1 text-xs text-content-subtle">
                      {p.aggravatingFactors && <span>↑ {p.aggravatingFactors}</span>}
                      {p.aggravatingFactors && p.relievingFactors && <span> · </span>}
                      {p.relievingFactors && <span>↓ {p.relievingFactors}</span>}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-content-subtle">Mesures du vélo</p>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Mesure du vélo</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Avant</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Après</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ value, info }) => (
                  <tr key={value.measurementId}>
                    <td className="px-3 py-1.5 text-content">{info.name}</td>
                    <td className="px-3 py-1.5 text-right text-content-muted">{fmt(value.before, info.unit)}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-content">{fmt(value.after, info.unit)}</td>
                    <td className="px-3 py-1.5 text-right"><MeasureDelta before={value.before} after={value.after} unit={info.unit} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {riderRows.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-content-subtle">Mesures du cycliste sur vélo</p>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Mesure du cycliste</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Avant</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Après</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {riderRows.map(({ value, info }) => (
                  <tr key={value.riderMeasurementId}>
                    <td className="px-3 py-1.5 text-content">{info.name}</td>
                    <td className="px-3 py-1.5 text-right text-content-muted">{fmt(value.before, info.unit)}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-content">{fmt(value.after, info.unit)}</td>
                    <td className="px-3 py-1.5 text-right"><MeasureDelta before={value.before} after={value.after} unit={info.unit} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {physioRows.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Test physio</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Résultat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {physioRows.map(({ result, info }) => (
                <tr key={result.physioTestId}>
                  <td className="px-3 py-1.5 text-content">
                    {info.name}
                    {result.comment?.trim() && (
                      <span className="mt-0.5 block text-xs text-content-subtle">{result.comment}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium text-content">
                    {formatPhysioValue(info.outputType, result.value, info.unit)}
                  </td>
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

      {study.summary && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-content-subtle">Bilan</p>
          <p className="mt-1 whitespace-pre-line text-sm text-content">{study.summary}</p>
        </div>
      )}

      {study.recommendations && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-content-subtle">Recommandations</p>
          <p className="mt-1 whitespace-pre-line text-sm text-content">{study.recommendations}</p>
        </div>
      )}

      {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
        <div className="mt-4">
          <PhotoComparison before={beforePhotos} after={afterPhotos} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {canEdit && (
          <Link href={`/dashboard/patients/${patientId}/etude?studyId=${study.id}`} prefetch={false}>
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
