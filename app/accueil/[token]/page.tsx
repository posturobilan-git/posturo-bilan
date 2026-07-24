import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { decryptFields } from "@/lib/crypto";
import { AccueilForm } from "./AccueilForm";

export const metadata: Metadata = {
  title: "Formulaire d'accueil",
  robots: { index: false, follow: false },
};

const CABINET = process.env.CABINET_NAME || "Posturo Vélo";

function Screen({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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

export default async function AccueilPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const raw = await prisma.patient.findUnique({
    where: { inviteToken: token },
    select: {
      firstName: true,
      isAnonymized: true,
      inviteExpiresAt: true,
      inviteCompletedAt: true,
    },
  });
  const patient = raw && decryptFields(raw, ["firstName"] as const);

  if (!patient || patient.isAnonymized) {
    return (
      <Screen title="Lien invalide">
        <p>
          Ce lien n&apos;est pas valide. Vérifiez l&apos;adresse ou contactez
          votre cabinet pour en recevoir un nouveau.
        </p>
      </Screen>
    );
  }

  if (patient.inviteCompletedAt) {
    return (
      <Screen title="Ce formulaire a déjà été complété">
        <p>
          Merci, nous avons bien reçu vos informations. Vous pouvez fermer cette
          page — votre kinésithérapeute vous recontactera si besoin.
        </p>
      </Screen>
    );
  }

  if (patient.inviteExpiresAt && patient.inviteExpiresAt < new Date()) {
    return (
      <Screen title="Lien expiré">
        <p>
          Ce lien a expiré. Contactez votre cabinet pour recevoir un nouveau
          formulaire d&apos;accueil.
        </p>
      </Screen>
    );
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <AccueilForm token={token} firstName={patient.firstName} cabinetName={CABINET} />
      </div>
    </main>
  );
}
