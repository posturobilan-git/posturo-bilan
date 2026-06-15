import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { SuiviForm } from "./SuiviForm";

export const metadata: Metadata = {
  title: "Suivi à 30 jours",
  robots: { index: false, follow: false },
};

const CABINET = process.env.CABINET_NAME || "PosturoBilan";

function Screen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-brand-600">{CABINET}</p>
        <h1 className="mt-3 text-xl font-semibold text-content">{title}</h1>
        <div className="mt-3 text-sm text-content-muted">{children}</div>
      </div>
    </main>
  );
}

export default async function SuiviPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const study = await prisma.study.findUnique({
    where: { followupToken: token },
    select: {
      followupCompletedAt: true,
      patient: { select: { firstName: true, isAnonymized: true } },
    },
  });

  if (!study || study.patient.isAnonymized) {
    return (
      <Screen title="Lien invalide">
        <p>
          Ce lien n&apos;est pas valide. Vérifiez l&apos;adresse ou contactez
          votre cabinet.
        </p>
      </Screen>
    );
  }

  if (study.followupCompletedAt) {
    return (
      <Screen title="Ce formulaire a déjà été complété">
        <p>
          Merci, nous avons bien reçu vos réponses. Vous pouvez fermer cette
          page.
        </p>
      </Screen>
    );
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <SuiviForm token={token} firstName={study.patient.firstName} cabinetName={CABINET} />
      </div>
    </main>
  );
}
