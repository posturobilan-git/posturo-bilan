import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentKine } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { SearchBar } from "@/components/patients/SearchBar";
import { RgpdActions } from "@/components/rgpd/RgpdActions";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

const ACTION_LABELS: Record<string, string> = {
  EXPORT: "Export",
  ANONYMIZE: "Anonymisation",
};

export default async function RgpdPage({ searchParams }: Props) {
  const kine = await getCurrentKine();
  if (!kine) redirect("/sign-in");
  if (kine.role !== "ADMIN") redirect("/dashboard");

  const { q } = await searchParams;

  const [patients, logs] = await Promise.all([
    prisma.patient.findMany({
      where: q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: { _count: { select: { studies: true, followups: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.auditLog.findMany({
      where: { action: { in: ["EXPORT", "ANONYMIZE"] } },
      include: { user: { select: { name: true } } },
      orderBy: { timestamp: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="RGPD & données personnelles"
        description="Export et anonymisation des données patients (réservé aux administrateurs)"
      />

      {/* Patient search + actions */}
      <div className="space-y-4">
        <Suspense>
          <SearchBar defaultValue={q} />
        </Suspense>

        {patients.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">
            Aucun patient trouvé.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Patient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Données</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Actions RGPD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {patients.map((p) => (
                  <tr key={p.id} className={p.isAnonymized ? "opacity-60" : ""}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{p.firstName} {p.lastName}</div>
                      <div className="text-sm text-gray-500">{p.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {p._count.studies} étude{p._count.studies !== 1 ? "s" : ""} · {p._count.followups} suivi{p._count.followups !== 1 ? "s" : ""}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <RgpdActions
                          patientId={p.id}
                          patientName={`${p.firstName} ${p.lastName}`}
                          isAnonymized={p.isAnonymized}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit trail */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Dernières actions RGPD</h2>
        <Card padding="none">
          {logs.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-gray-500">Aucune action enregistrée.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Par</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Patient (ID)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-3 text-gray-500">
                      {new Date(log.timestamp).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        log.action === "ANONYMIZE" ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-700"
                      }`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-700">{log.user.name}</td>
                    <td className="px-6 py-3 font-mono text-xs text-gray-400">{log.entityId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
