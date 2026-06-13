import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StudyCard } from "@/components/patients/StudyCard";
import type { PatientWithRelations, MeasurementInfo } from "@/types";
import type { PhysioTestInfo } from "@/lib/physio";

// ─── Utility ──────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-content-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-content">{value}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 text-base font-semibold text-content">{children}</h3>;
}

function Score({ label, value }: { label: string; value: number | null | undefined }) {
  if (value === null || value === undefined) return null;
  const pct = (value / 10) * 100;
  const color = value >= 7 ? "bg-success-600" : value >= 4 ? "bg-warning-600" : "bg-danger-500";
  return (
    <div>
      <div className="flex justify-between text-xs text-content-muted">
        <span>{label}</span>
        <span className="font-medium text-content">{value}/10</span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-surface-muted">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Panel Amont (Intake) ─────────────────────────────────────────────────────

function PanelAmont({
  intake,
  patientId,
  consentAcceptedAt,
  consentVersion,
}: {
  intake: PatientWithRelations["intake"];
  patientId: string;
  consentAcceptedAt: Date | null;
  consentVersion: string | null;
}) {
  if (!intake) {
    return (
      <Card>
        <SectionTitle>Amont — Données d&apos;accueil</SectionTitle>
        <p className="text-sm text-content-subtle italic">Accueil non encore renseigné.</p>
        <Link
          href={`/patients/${patientId}/intake`}
          className="mt-3 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          + Saisir l&apos;accueil
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>Amont — Données intake</SectionTitle>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
        <Field label="Taille" value={intake.heightCm ? `${intake.heightCm} cm` : undefined} />
        <Field label="Poids" value={intake.weightKg ? `${intake.weightKg} kg` : undefined} />
        <Field label="Type de vélo" value={intake.bikeType} />
        <Field label="Niveau" value={intake.ridingLevel} />
        <Field label="Heures/semaine" value={intake.weeklyHours ?? undefined} />
        <Field label="Années de pratique" value={intake.yearsRiding ?? undefined} />
      </dl>
      {intake.injuries.length > 0 && (
        <div className="mt-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-content-subtle">Douleurs déclarées</dt>
          <div className="mt-1 flex flex-wrap gap-1">
            {intake.injuries.map((injury, i) => (
              <span key={i} className="rounded-full bg-danger-50 px-2.5 py-0.5 text-xs text-danger-700">
                {injury}
              </span>
            ))}
          </div>
        </div>
      )}
      {intake.goals && (
        <div className="mt-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-content-subtle">Objectifs</dt>
          <dd className="mt-0.5 text-sm text-content">{intake.goals}</dd>
        </div>
      )}
      {intake.medicalNotes && (
        <div className="mt-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-content-subtle">Notes médicales</dt>
          <dd className="mt-0.5 text-sm text-content">{intake.medicalNotes}</dd>
        </div>
      )}
      {consentAcceptedAt && (
        <p className="mt-4 border-t border-border pt-3 text-xs text-content-subtle">
          Consentement RGPD recueilli le{" "}
          {new Date(consentAcceptedAt).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
          {consentVersion && ` (v. ${consentVersion})`}.
        </p>
      )}
    </Card>
  );
}

// ─── Section Études (une carte par étude) ─────────────────────────────────────

function StudiesSection({
  patient,
  canEdit,
  measurementsById,
  physioTestsById,
}: {
  patient: PatientWithRelations;
  canEdit: boolean;
  measurementsById: Record<string, MeasurementInfo>;
  physioTestsById: Record<string, PhysioTestInfo>;
}) {
  const { studies } = patient;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-content">
          Études posturales
          <span className="ml-2 text-sm font-normal text-content-subtle">
            ({studies.length})
          </span>
        </h3>
        {canEdit && (
          <Link href={`/patients/${patient.id}/etude`}>
            <Button size="sm">+ Nouvelle étude</Button>
          </Link>
        )}
      </div>

      {studies.length === 0 ? (
        <Card>
          <p className="text-sm text-content-subtle italic">
            Aucune étude réalisée. {canEdit && "Démarrez la première avec « Nouvelle étude »."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {studies.map((study) => (
            <StudyCard
              key={study.id}
              study={study}
              patientId={patient.id}
              canEdit={canEdit}
              measurementsById={measurementsById}
              physioTestsById={physioTestsById}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Panel Suivi ──────────────────────────────────────────────────────────────

function PanelSuivi({ followup }: { followup: PatientWithRelations["followups"][number] | undefined }) {
  if (!followup) {
    return (
      <Card>
        <SectionTitle>Suivi J+30</SectionTitle>
        <p className="text-sm text-content-subtle italic">Aucun suivi reçu.</p>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>Suivi J+30</SectionTitle>
      <div className="space-y-3">
        <Score label="Niveau de douleur" value={followup.painLevel} />
        <Score label="Confort" value={followup.comfortScore} />
        <Score label="Satisfaction" value={followup.satisfactionScore} />
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
        <Field label="Fréquence de pratique" value={followup.ridingFrequency} />
        <Field
          label="Reprise du sport"
          value={followup.returningToSport === null ? undefined : followup.returningToSport ? "Oui" : "Non"}
        />
      </dl>
      {followup.generalFeedback && (
        <div className="mt-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-content-subtle">Commentaire</dt>
          <dd className="mt-0.5 text-sm text-content">{followup.generalFeedback}</dd>
        </div>
      )}
    </Card>
  );
}

// ─── Évolution (tableau comparatif) ──────────────────────────────────────────

function EvolutionTable({ patient }: { patient: PatientWithRelations }) {
  const { followups } = patient;
  if (followups.length === 0) return null;

  return (
    <Card padding="none">
      <div className="border-b border-border px-6 py-4">
        <h3 className="text-base font-semibold text-content">Évolution — Amont → Suivis</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-muted">
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">
                Métrique
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">
                Amont
              </th>
              {followups.map((f, i) => (
                <th key={f.id} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-subtle">
                  Suivi {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[
              { label: "Douleur (/10)", key: "painLevel" as const, intakeValue: "—" },
              { label: "Confort (/10)", key: "comfortScore" as const, intakeValue: "—" },
              { label: "Satisfaction (/10)", key: "satisfactionScore" as const, intakeValue: "—" },
            ].map(({ label, key, intakeValue }) => (
              <tr key={key} className="transition-colors hover:bg-surface-muted">
                <td className="px-6 py-3 font-medium text-content">{label}</td>
                <td className="px-6 py-3 text-content-muted">{intakeValue}</td>
                {followups.map((f) => (
                  <td key={f.id} className="px-6 py-3 text-content">
                    {f[key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function PatientDossier({
  patient,
  canEdit = false,
  measurementsById = {},
  physioTestsById = {},
}: {
  patient: PatientWithRelations;
  canEdit?: boolean;
  measurementsById?: Record<string, MeasurementInfo>;
  physioTestsById?: Record<string, PhysioTestInfo>;
}) {
  const latestFollowup = patient.followups.at(-1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PanelAmont
          intake={patient.intake}
          patientId={patient.id}
          consentAcceptedAt={patient.consentAcceptedAt}
          consentVersion={patient.consentVersion}
        />
        <PanelSuivi followup={latestFollowup} />
      </div>
      <StudiesSection
        patient={patient}
        canEdit={canEdit}
        measurementsById={measurementsById}
        physioTestsById={physioTestsById}
      />
      <EvolutionTable patient={patient} />
    </div>
  );
}
