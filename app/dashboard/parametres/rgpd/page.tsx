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
          <SearchBar defaultValue={q} placeholder="Rechercher un patient…" />
        </Suspense>

        {patients.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong py-10 text-center text-sm text-content-muted">
            Aucun patient trouvé.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-muted">Patient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-muted">Données</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-content-muted">Actions RGPD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {patients.map((p) => (
                  <tr key={p.id} className={p.isAnonymized ? "opacity-60" : ""}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-content">{p.firstName} {p.lastName}</div>
                      <div className="text-sm text-content-muted">{p.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-content-muted">
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
        <h2 className="text-lg font-semibold text-content">Dernières actions RGPD</h2>
        <Card padding="none">
          {logs.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-content-muted">Aucune action enregistrée.</p>
          ) : (
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-muted">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-muted">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-muted">Par</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-muted">Patient (ID)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-3 text-content-muted">
                      {new Date(log.timestamp).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        log.action === "ANONYMIZE" ? "bg-danger-50 text-danger-700" : "bg-brand-50 text-brand-700"
                      }`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-content">{log.user.name}</td>
                    <td className="px-6 py-3 font-mono text-xs text-content-subtle">{log.entityId}</td>
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
