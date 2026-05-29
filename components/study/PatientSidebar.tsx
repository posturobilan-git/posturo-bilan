import type { Patient, PatientIntake } from "@prisma/client";

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

interface Props {
  patient: Patient & { intake: PatientIntake | null };
}

export function PatientSidebar({ patient }: Props) {
  const { intake } = patient;

  return (
    <aside className="rounded-lg border border-gray-200 bg-white">
      {/* On mobile this is a collapsible accordion; on desktop (lg+) the
          summary is hidden and the content stays expanded via `open`. */}
      <details open className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between p-5 lg:hidden [&::-webkit-details-marker]:hidden">
          <span className="text-sm font-semibold text-gray-900">
            {patient.firstName} {patient.lastName}
          </span>
          <svg
            className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>

        <div className="flex flex-col gap-5 p-5 pt-0 lg:pt-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Patient</p>
        <p className="mt-1 text-base font-semibold text-gray-900">
          {patient.firstName} {patient.lastName}
        </p>
        <p className="text-sm text-gray-500">{patient.email}</p>
      </div>

      {intake ? (
        <>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Morphologie</p>
            <Row label="Taille" value={intake.heightCm ? `${intake.heightCm} cm` : null} />
            <Row label="Poids" value={intake.weightKg ? `${intake.weightKg} kg` : null} />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pratique vélo</p>
            <Row label="Type de vélo" value={intake.bikeType} />
            <Row label="Niveau" value={intake.ridingLevel} />
            <Row label="Heures/semaine" value={intake.weeklyHours} />
            <Row label="Années de pratique" value={intake.yearsRiding} />
          </div>

          {intake.injuries.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Douleurs déclarées</p>
              <div className="flex flex-wrap gap-1">
                {intake.injuries.map((injury, i) => (
                  <span key={i} className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                    {injury}
                  </span>
                ))}
              </div>
            </div>
          )}

          {intake.goals && (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Objectifs</p>
              <p className="text-sm text-gray-700">{intake.goals}</p>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm italic text-gray-400">Formulaire intake non reçu.</p>
      )}
        </div>
      </details>
    </aside>
  );
}
