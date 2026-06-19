"use client";

import { Button } from "@/components/ui/Button";
import { MeasureDelta } from "./MeasureDelta";
import { formatPhysioValue, type PhysioValue } from "@/lib/physio";
import type { PhysioOutputType } from "@prisma/client";

export interface RecapMeasureRow {
  id: string;
  name: string;
  unit: string;
  before: number | null;
  after: number | null;
}

export interface RecapPhysioRow {
  id: string;
  name: string;
  outputType: PhysioOutputType;
  unit: string | null;
  value: PhysioValue;
  comment: string | null;
}

const inputClass =
  "rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-content focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function fmt(value: number | null, unit: string): string {
  return value == null ? "—" : `${value} ${unit}`;
}

function MeasureTable({ title, rows }: { title: string; rows: RecapMeasureRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-content-subtle">{title}</p>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Mesure</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Avant</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Après</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-1.5 text-content">{r.name}</td>
                <td className="px-3 py-1.5 text-right text-content-muted">{fmt(r.before, r.unit)}</td>
                <td className="px-3 py-1.5 text-right font-medium text-content">{fmt(r.after, r.unit)}</td>
                <td className="px-3 py-1.5 text-right"><MeasureDelta before={r.before} after={r.after} unit={r.unit} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface Props {
  measureRows: RecapMeasureRow[];
  riderMeasureRows: RecapMeasureRow[];
  physioRows: RecapPhysioRow[];
  summary: string;
  recommendations: string;
  onSetSummary: (text: string) => void;
  onSetRecommendations: (text: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function StudySummaryStep({
  measureRows,
  riderMeasureRows,
  physioRows,
  summary,
  recommendations,
  onSetSummary,
  onSetRecommendations,
  onBack,
  onSubmit,
  submitting,
}: Props) {
  const nothingMeasured =
    measureRows.length === 0 && riderMeasureRows.length === 0 && physioRows.length === 0;

  return (
    <div className="space-y-6">
      <p className="text-sm text-content-muted">
        Récapitulatif des relevés de l&apos;étude (lecture seule), puis rédigez le
        bilan et les recommandations avant de soumettre.
      </p>

      {nothingMeasured ? (
        <div className="rounded-lg border border-dashed border-border-strong py-6 text-center">
          <p className="text-sm text-content-subtle">Aucune mesure ni test renseigné.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <MeasureTable title="Mesures du vélo" rows={measureRows} />
          <MeasureTable title="Mesures du cycliste sur vélo" rows={riderMeasureRows} />

          {physioRows.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-content-subtle">Tests physiologiques</p>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-surface-muted">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">Test physio</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-content-subtle">Résultat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {physioRows.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-1.5 text-content">
                          {r.name}
                          {r.comment?.trim() && (
                            <span className="mt-0.5 block text-xs text-content-subtle">{r.comment}</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium text-content">
                          {formatPhysioValue(r.outputType, r.value, r.unit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-content-muted">Bilan</span>
        <textarea
          rows={5}
          maxLength={5000}
          value={summary}
          onChange={(e) => onSetSummary(e.target.value)}
          placeholder="Synthèse de l'étude posturale…"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-content-muted">Recommandations</span>
        <textarea
          rows={5}
          maxLength={5000}
          value={recommendations}
          onChange={(e) => onSetRecommendations(e.target.value)}
          placeholder="Conseils, suivi, points de vigilance… (hors exercices prescrits)"
          className={inputClass}
        />
      </label>

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={onBack}>← Étape précédente</Button>
        <Button onClick={onSubmit} loading={submitting}>
          Soumettre l&apos;étude ✓
        </Button>
      </div>
    </div>
  );
}
